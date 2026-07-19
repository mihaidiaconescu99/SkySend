import "server-only";
import {
  buildBlockingProductClarifications,
  getDeterministicParcelWeightBounds,
  getLocalParcelAssistantResult,
  getSemanticParcelEstimate,
  parseExplicitParcelWeightKg,
  parseLiquidVolumeLiters,
} from "@/lib/parcel-assistant";
import { estimateParcelWithOpenRouter } from "@/lib/ai/openrouter-parcel-estimator";
import { runProductLookupForEstimate } from "@/lib/ai/tavily-product-lookup";
import { lookupExactCatalogProducts } from "@/lib/ai/product-catalog";
import { getRecommendedDrone } from "@/lib/drone-recommendation";
import type { DroneClass } from "@/types/domain";
import type { ParcelDimensions } from "@/types/drone";
import type {
  ParcelAssistantInput,
  ParcelCategory,
  ParcelFragileLevel,
  ParcelPackagingType,
} from "@/types/parcel-assistant";
import type {
  ParcelEstimatorConfidence,
  ParcelEstimatorCorrection,
  ParcelEstimatorRequest,
  ParcelEstimatorResponse,
} from "@/types/parcel-estimator";
import type {
  ParcelClarificationQuestion,
  ParcelDetectedItem,
  ParcelEstimatedDimensions,
  ParcelEstimatedWeightRange,
  ParcelHandlingNote,
  ParcelIntelligenceConfidenceLevel,
  ParcelIntelligenceEstimate,
  ParcelLookupTrace,
  ParcelPackagingInference,
  ParcelRiskFlag,
  ParcelWeatherSensitivity,
  ProductLookupResult,
} from "@/types/parcel-intelligence";

type RawParcelEstimate = {
  detectedItems: string[];
  detectedItemsDetailed?: ParcelDetectedItem[];
  materials: string[];
  packagingAssumption: string;
  packagingInference?: ParcelPackagingInference | null;
  estimatedWeightMin: number;
  estimatedWeightMax: number;
  estimatedWeightRange?: ParcelEstimatedWeightRange;
  suggestedDimensionsCm?: ParcelDimensions | null;
  estimatedDimensions?: ParcelEstimatedDimensions | null;
  volumeLiters?: number | null;
  category?: ParcelCategory;
  confidenceScore?: number | null;
  confidence: ParcelEstimatorConfidence;
  fragileLevel: "low" | "medium" | "high";
  handlingNotes?: ParcelHandlingNote[];
  weatherSensitivity?: ParcelWeatherSensitivity | null;
  riskFlags?: ParcelRiskFlag[];
  clarificationQuestions?: ParcelClarificationQuestion[];
  recommendedDroneClass: DroneClass;
  explanation: string;
};

const fragileLevelRank: Record<ParcelFragileLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
};

const droneClassIds = [
  "light_swift",
  "light_secure",
  "medium_standard",
  "medium_stabilized",
  "medium_long_range",
  "heavy_cargo",
  "heavy_max",
] as const satisfies readonly DroneClass[];

const categoryIds = [
  "documents",
  "retail",
  "food",
  "medical",
  "electronics",
  "special",
] as const satisfies readonly ParcelCategory[];

const packagingIds = [
  "soft_pouch",
  "plastic_bag",
  "boxed",
  "insulated",
  "fragile_protective",
  "heavy_duty",
] as const satisfies readonly ParcelPackagingType[];

const maxFleetPayloadKg = 12;
const safetyNote = "Greutatea finală va fi confirmată la pickup" as const;

function getNaturalDescriptionText(input: ParcelEstimatorRequest) {
  return input.naturalDescription?.text.trim() || input.contentDescription.trim();
}

function getEffectivePackaging(input: ParcelEstimatorRequest) {
  return input.advancedDetails?.packagingType ?? input.packaging;
}

function normalizeSearchText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function answerToText(answer: string | number | boolean | string[]) {
  return Array.isArray(answer) ? answer.join(" ") : String(answer);
}

function getClarificationAnswerText(input: ParcelEstimatorRequest) {
  return (
    input.previousClarificationAnswers
      ?.map((answer) => answerToText(answer.answer))
      .join(" ") ?? ""
  );
}

function needsComputerTypeClarification(input: ParcelEstimatorRequest) {
  const description = normalizeSearchText(getNaturalDescriptionText(input));

  if (!/\b(calculator|computer)\b/u.test(description)) {
    return false;
  }

  const combinedText = `${description} ${normalizeSearchText(
    getClarificationAnswerText(input),
  )}`;
  const hasSpecificComputerType =
    /\b(desktop|pc|unitate|tower|birou|laptop|notebook|macbook|monitor|display|ecran|tastatura|keyboard|mouse|maus|periferice|accesorii|cablu|cabluri|incarcator)\b/u.test(
      combinedText,
    );

  return !hasSpecificComputerType;
}

function toParcelAssistantInput(input: ParcelEstimatorRequest): ParcelAssistantInput {
  return {
    contents: getNaturalDescriptionText(input),
    naturalDescription: input.naturalDescription,
    advancedDetails: input.advancedDetails,
    previousClarificationAnswers: input.previousClarificationAnswers,
    category: input.category,
    packaging: getEffectivePackaging(input),
    approximateSize: input.approximateSize,
    fragilityLevel: input.currentFragileLevel ?? undefined,
  };
}

function parseWeightRange(range: string) {
  const values = range
    .replace(",", ".")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((value) => Number.isFinite(value));

  if (!values?.length) {
    return {
      min: 0.4,
      max: 3,
    };
  }

  const min = values[0];
  const max = values[1] ?? values[0];

  return {
    min: Math.min(min, max),
    max: Math.max(min, max),
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function compactStringArray(value: unknown, fallback: string[] = []) {
  return isStringArray(value)
    ? value.map((item) => item.trim()).filter(Boolean).slice(0, 8)
    : fallback;
}

function isValidAiFragileLevel(value: unknown): value is RawParcelEstimate["fragileLevel"] {
  return value === "low" || value === "medium" || value === "high";
}

function toParcelFragileLevel(value: RawParcelEstimate["fragileLevel"]): ParcelFragileLevel {
  return value === "medium" ? "moderate" : value;
}

function isValidConfidence(value: unknown): value is ParcelEstimatorConfidence {
  return value === "low" || value === "medium" || value === "high";
}

function isValidDroneClass(value: unknown): value is (typeof droneClassIds)[number] {
  return droneClassIds.includes(value as (typeof droneClassIds)[number]);
}

function isValidCategory(value: unknown): value is ParcelCategory {
  return categoryIds.includes(value as ParcelCategory);
}

function isValidPackaging(value: unknown): value is ParcelPackagingType {
  return packagingIds.includes(value as ParcelPackagingType);
}

function normalizeNumber(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return Number(Math.min(Math.max(value, min), max).toFixed(2));
}

function parseDimensions(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const lengthCm = normalizeNumber(record.lengthCm, 1, 70);
  const widthCm = normalizeNumber(record.widthCm, 1, 55);
  const heightCm = normalizeNumber(record.heightCm, 1, 40);

  if (lengthCm === null || widthCm === null || heightCm === null) {
    return null;
  }

  return { lengthCm, widthCm, heightCm };
}

function getVolumeLiters(dimensions: ParcelDimensions) {
  return Number(
    ((dimensions.lengthCm * dimensions.widthCm * dimensions.heightCm) / 1000).toFixed(1),
  );
}

function toConfidenceScore(confidence: ParcelEstimatorConfidence) {
  if (confidence === "high") {
    return 86;
  }

  if (confidence === "medium") {
    return 62;
  }

  return 34;
}

function normalizeConfidenceScore(value: unknown, fallback: number) {
  return normalizeNumber(value, 0, 100) ?? fallback;
}

function confidenceFromScore(score: number): ParcelEstimatorConfidence {
  if (score >= 76) {
    return "high";
  }

  if (score >= 45) {
    return "medium";
  }

  return "low";
}

function formatWeightLabel(minKg: number, maxKg: number) {
  return minKg === maxKg ? `${minKg} kg` : `${minKg} - ${maxKg} kg`;
}

function buildWeightRange(
  minKg: number,
  maxKg: number,
  source: ParcelEstimatedWeightRange["source"],
): ParcelEstimatedWeightRange {
  const roundedMin = Number(minKg.toFixed(1));
  const roundedMax = Number(Math.max(maxKg, roundedMin).toFixed(1));

  return {
    minKg: roundedMin,
    maxKg: roundedMax,
    midpointKg: Number(((roundedMin + roundedMax) / 2).toFixed(1)),
    label: formatWeightLabel(roundedMin, roundedMax),
    source,
  };
}

function buildEstimatedDimensions(
  dimensionsCm: ParcelDimensions,
  source: ParcelEstimatedDimensions["source"],
): ParcelEstimatedDimensions {
  return {
    dimensionsCm,
    volumeLiters: getVolumeLiters(dimensionsCm),
    source,
    fitNotes: [],
  };
}

function parseWeightRangeObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const minKg = normalizeNumber(record.minKg, 0.1, maxFleetPayloadKg);
  const maxKg = normalizeNumber(record.maxKg, 0.1, maxFleetPayloadKg);

  if (minKg === null || maxKg === null) {
    return null;
  }

  return buildWeightRange(
    Math.min(minKg, maxKg),
    Math.max(minKg, maxKg),
    record.source === "user_declared" ||
      record.source === "openrouter" ||
      record.source === "local" ||
      record.source === "operator"
      ? record.source
      : "openrouter",
  );
}

function parseEstimatedDimensionsObject(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const dimensionsCm = parseDimensions(record.dimensionsCm);

  if (!dimensionsCm) {
    return null;
  }

  return {
    dimensionsCm,
    volumeLiters:
      normalizeNumber(record.volumeLiters, 0.1, 160) ?? getVolumeLiters(dimensionsCm),
    source:
      record.source === "user_declared" ||
      record.source === "openrouter" ||
      record.source === "local" ||
      record.source === "operator"
        ? record.source
        : "openrouter",
    fitNotes: compactStringArray(record.fitNotes),
  } satisfies ParcelEstimatedDimensions;
}

function parseDetectedItemsDetailed(value: unknown): ParcelDetectedItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;

      if (typeof record.label !== "string" || !record.label.trim()) {
        return null;
      }

      return {
        label: record.label.trim(),
        quantity: normalizeNumber(record.quantity, 0, 999),
        category: isValidCategory(record.category) ? record.category : null,
        materials: compactStringArray(record.materials),
        estimatedWeightRangeKg: parseWeightRangeObject(record.estimatedWeightRangeKg),
        estimatedDimensionsCm: parseDimensions(record.estimatedDimensionsCm),
        confidenceScore: normalizeNumber(record.confidenceScore, 0, 100),
        evidence: typeof record.evidence === "string" ? record.evidence.trim() : null,
        productIdentifier: typeof record.productIdentifier === "string" ? record.productIdentifier.trim() || null : null,
        brand: typeof record.brand === "string" ? record.brand.trim() || null : null,
        model: typeof record.model === "string" ? record.model.trim() || null : null,
        packagingState: record.packagingState === "packaged" || record.packagingState === "unpackaged" ? record.packagingState : "unknown",
        profileSource: "text",
      } satisfies ParcelDetectedItem;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 8);
}

function parsePackagingInference(
  value: unknown,
  fallbackPackaging: ParcelPackagingType,
  fallbackAssumption: string,
  fallbackConfidence: ParcelEstimatorConfidence,
): ParcelPackagingInference {
  if (!value || typeof value !== "object") {
    const confidenceScore = toConfidenceScore(fallbackConfidence);

    return {
      packagingType: fallbackPackaging,
      assumption: fallbackAssumption,
      confidenceScore,
      confidence: fallbackConfidence,
      alternatives: [],
    };
  }

  const record = value as Record<string, unknown>;
  const confidenceScore = normalizeConfidenceScore(
    record.confidenceScore,
    toConfidenceScore(fallbackConfidence),
  );

  return {
    packagingType: isValidPackaging(record.packagingType)
      ? record.packagingType
      : fallbackPackaging,
    assumption:
      typeof record.assumption === "string" && record.assumption.trim()
        ? record.assumption.trim()
        : fallbackAssumption,
    confidenceScore,
    confidence: isValidConfidence(record.confidence)
      ? record.confidence
      : confidenceFromScore(confidenceScore),
    alternatives: [],
  };
}

function parseHandlingNotes(value: unknown, fallback: ParcelHandlingNote[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const code =
        record.code === "fragile" ||
        record.code === "keep_upright" ||
        record.code === "temperature_sensitive" ||
        record.code === "sealed_required" ||
        record.code === "do_not_stack" ||
        record.code === "operator_review" ||
        record.code === "other"
          ? record.code
          : "other";

      if (typeof record.label !== "string" || !record.label.trim()) {
        return null;
      }

      return {
        code,
        label: record.label.trim(),
        details: typeof record.details === "string" ? record.details.trim() : null,
      } satisfies ParcelHandlingNote;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 6);
}

function parseWeatherSensitivity(
  value: unknown,
  fallback: ParcelWeatherSensitivity,
) {
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const record = value as Record<string, unknown>;

  return {
    rain: Boolean(record.rain),
    wind: Boolean(record.wind),
    heat: Boolean(record.heat),
    cold: Boolean(record.cold),
    humidity: Boolean(record.humidity),
    notes: typeof record.notes === "string" ? record.notes.trim() : null,
  } satisfies ParcelWeatherSensitivity;
}

function parseRiskFlags(value: unknown, fallback: ParcelRiskFlag[]) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const severity =
        record.severity === "high" || record.severity === "medium"
          ? record.severity
          : "low";

      if (
        typeof record.label !== "string" ||
        !record.label.trim() ||
        typeof record.reason !== "string" ||
        !record.reason.trim()
      ) {
        return null;
      }

      return {
        code:
          record.code === "overweight" ||
          record.code === "oversize" ||
          record.code === "fragile" ||
          record.code === "restricted_contents" ||
          record.code === "weather_sensitive" ||
          record.code === "low_confidence" ||
          record.code === "needs_clarification" ||
          record.code === "operator_review" ||
          record.code === "other"
            ? record.code
            : "other",
        severity,
        label: record.label.trim(),
        reason: record.reason.trim(),
      } satisfies ParcelRiskFlag;
    })
    .filter((item): item is ParcelRiskFlag => Boolean(item))
    .slice(0, 8);
}

function parseClarificationQuestions(value: unknown, fallback: ParcelClarificationQuestion[]) {
  if (!Array.isArray(value)) {
    return fallback.slice(0, 3);
  }

  const parsed = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;

      if (
        typeof record.id !== "string" ||
        !record.id.trim() ||
        typeof record.question !== "string" ||
        !record.question.trim()
      ) {
        return null;
      }

      return {
        id: record.id.trim(),
        question: record.question.trim(),
        field:
          record.field === "contents" ||
          record.field === "category" ||
          record.field === "packaging" ||
          record.field === "weight" ||
          record.field === "dimensions" ||
          record.field === "fragility" ||
          record.field === "handling" ||
          record.field === "weather_sensitivity" ||
          record.field === "other"
            ? record.field
            : "other",
        answerType:
          record.answerType === "single_select" ||
          record.answerType === "multi_select" ||
          record.answerType === "number" ||
          record.answerType === "boolean"
            ? record.answerType
            : "text",
        options: Array.isArray(record.options)
          ? record.options
              .map((option) => {
                if (!option || typeof option !== "object") {
                  return null;
                }

                const optionRecord = option as Record<string, unknown>;

                return typeof optionRecord.value === "string" &&
                  typeof optionRecord.label === "string"
                  ? {
                      value: optionRecord.value,
                      label: optionRecord.label,
                    }
                  : null;
              })
              .filter((option): option is NonNullable<typeof option> => Boolean(option))
              .slice(0, 6)
          : [],
        required: Boolean(record.required),
        blocksConfirmation: Boolean(record.blocksConfirmation),
        reason: typeof record.reason === "string" ? record.reason.trim() : null,
      } satisfies ParcelClarificationQuestion;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 3);

  return parsed.length ? parsed : fallback.slice(0, 3);
}

function parseRawParcelEstimate(value: unknown): RawParcelEstimate | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const nestedWeight = parseWeightRangeObject(record.estimatedWeightRange);
  const estimatedWeightMin =
    normalizeNumber(record.estimatedWeightMin, 0.1, maxFleetPayloadKg) ??
    nestedWeight?.minKg ??
    null;
  const estimatedWeightMax =
    normalizeNumber(record.estimatedWeightMax, 0.1, maxFleetPayloadKg) ??
    nestedWeight?.maxKg ??
    null;

  if (
    estimatedWeightMin === null ||
    estimatedWeightMax === null ||
    !isValidConfidence(record.confidence) ||
    !isValidAiFragileLevel(record.fragileLevel) ||
    !isValidDroneClass(record.recommendedDroneClass) ||
    typeof record.explanation !== "string"
  ) {
    return null;
  }

  const suggestedDimensionsCm =
    parseDimensions(record.suggestedDimensionsCm) ??
    parseEstimatedDimensionsObject(record.estimatedDimensions)?.dimensionsCm ??
    null;

  return {
    detectedItems: compactStringArray(record.detectedItems),
    detectedItemsDetailed: parseDetectedItemsDetailed(record.detectedItemsDetailed),
    materials: compactStringArray(record.materials),
    packagingAssumption:
      typeof record.packagingAssumption === "string"
        ? record.packagingAssumption.trim()
        : "",
    packagingInference: parsePackagingInference(
      record.packagingInference,
      "boxed",
      typeof record.packagingAssumption === "string"
        ? record.packagingAssumption.trim()
        : "Packaging inferred from parcel description.",
      record.confidence,
    ),
    estimatedWeightMin: Math.min(estimatedWeightMin, estimatedWeightMax),
    estimatedWeightMax: Math.max(estimatedWeightMin, estimatedWeightMax),
    estimatedWeightRange:
      nestedWeight ??
      buildWeightRange(
        Math.min(estimatedWeightMin, estimatedWeightMax),
        Math.max(estimatedWeightMin, estimatedWeightMax),
        "openrouter",
      ),
    suggestedDimensionsCm,
    estimatedDimensions:
      parseEstimatedDimensionsObject(record.estimatedDimensions) ??
      (suggestedDimensionsCm
        ? buildEstimatedDimensions(suggestedDimensionsCm, "openrouter")
        : null),
    volumeLiters: normalizeNumber(record.volumeLiters, 0.1, 160),
    category: isValidCategory(record.category) ? record.category : undefined,
    confidenceScore: normalizeConfidenceScore(
      record.confidenceScore,
      toConfidenceScore(record.confidence),
    ),
    confidence: record.confidence,
    fragileLevel: record.fragileLevel,
    handlingNotes: parseHandlingNotes(record.handlingNotes, []),
    weatherSensitivity: parseWeatherSensitivity(record.weatherSensitivity, {}),
    riskFlags: parseRiskFlags(record.riskFlags, []),
    clarificationQuestions: parseClarificationQuestions(record.clarificationQuestions, []),
    recommendedDroneClass: record.recommendedDroneClass,
    explanation: record.explanation.trim(),
  };
}

function getHigherFragileLevel(
  left: ParcelFragileLevel,
  right: ParcelFragileLevel,
) {
  return fragileLevelRank[left] >= fragileLevelRank[right] ? left : right;
}

function clampWeightToBaseline(
  aiWeight: { min: number; max: number },
  localWeight: { min: number; max: number },
  explicitWeightKg: number | null,
  declaredWeightKg: number | null | undefined,
) {
  const trustedWeightKg = declaredWeightKg && declaredWeightKg > 0
    ? declaredWeightKg
    : explicitWeightKg;

  if (trustedWeightKg !== null && trustedWeightKg !== undefined) {
    return {
      min: trustedWeightKg,
      max: trustedWeightKg,
    };
  }

  const floor = Math.max(0.1, localWeight.min * 0.65);
  const ceiling = Math.min(maxFleetPayloadKg, localWeight.max * 1.45);
  const min = Math.min(Math.max(aiWeight.min, floor), ceiling);
  const max = Math.min(Math.max(aiWeight.max, min + 0.1, floor), ceiling);

  return {
    min: Number(min.toFixed(1)),
    max: Number(max.toFixed(1)),
  };
}

function hasWeightBelowBounds(
  aiWeight: { min: number; max: number },
  bounds: { minKg: number; maxKg: number },
) {
  const toleranceKg = 0.05;

  return (
    aiWeight.min < bounds.minKg - toleranceKg ||
    aiWeight.max < bounds.minKg - toleranceKg
  );
}

function hasWeightWildlyAboveBounds(
  aiWeight: { min: number; max: number },
  bounds: { minKg: number; maxKg: number },
) {
  const toleranceKg = Math.max(1.5, bounds.maxKg * 0.75);
  const upperLimit = bounds.maxKg + toleranceKg;

  return aiWeight.min > upperLimit || aiWeight.max > upperLimit * 1.15;
}

function appendExplanationNote(explanation: string, note?: string) {
  if (!note || explanation.includes(note)) {
    return explanation;
  }

  return `${explanation} ${note}`;
}

function formatVolumeLiters(value: number) {
  return Number(value.toFixed(value % 1 === 0 ? 0 : 2)).toString();
}

function buildCorrectionMessage({
  reason,
  detectedVolumeLiters,
  fallbackNote,
}: {
  reason: "declared_weight" | "explicit_weight" | "liquid_volume" | "semantic_profile";
  detectedVolumeLiters?: number | null;
  fallbackNote?: string;
}) {
  if (reason === "liquid_volume" && detectedVolumeLiters) {
    return `Am ajustat greutatea după volumul detectat: ${formatVolumeLiters(
      detectedVolumeLiters,
    )} L lichid + ambalaj.`;
  }

  if (reason === "declared_weight" || reason === "explicit_weight") {
    return "Am ajustat greutatea după valoarea declarată în descriere.";
  }

  return fallbackNote ?? "Am ajustat estimarea după regulile fizice detectate.";
}

function getRecommendedDroneClassForEstimate({
  weightRange,
  estimatedDimensions,
  fragileLevel,
  fallback,
}: {
  weightRange: ParcelEstimatedWeightRange;
  estimatedDimensions: ParcelEstimatedDimensions;
  fragileLevel: ParcelFragileLevel;
  fallback: DroneClass;
}) {
  const payloadKg = Math.min(
    maxFleetPayloadKg,
    weightRange.midpointKg ?? (weightRange.minKg + weightRange.maxKg) / 2,
  );
  const recommendedDrone = getRecommendedDrone({
    payloadKg,
    parcelDimensionsCm: estimatedDimensions.dimensionsCm,
    deliveryDistanceKm: payloadKg > 5 ? 16 : payloadKg > 2.5 ? 11 : 8,
    urgency: fragileLevel === "high" ? "priority" : "standard",
    requiresFragileHandling: fragileLevel === "high",
  });

  return recommendedDrone?.id ?? fallback;
}

function buildDetectedItems(
  input: ParcelEstimatorRequest,
  assistantInput: ParcelAssistantInput,
): ParcelDetectedItem[] {
  const semanticEstimate = getSemanticParcelEstimate(assistantInput);

  if (semanticEstimate?.itemProfiles.length) {
    return semanticEstimate.itemProfiles.map((profile) => ({
      id: profile.id,
      label: profile.label,
      quantity: null,
      category: profile.category,
      materials: [...profile.materials],
      estimatedWeightRangeKg: buildWeightRange(profile.minKg, profile.maxKg, "local"),
      estimatedDimensionsCm: profile.dimensionsCm,
      confidenceScore: 86,
      evidence: "Matched local parcel keywords.",
    }));
  }

  const description = getNaturalDescriptionText(input);

  return description
    ? [
        {
          label: description,
          quantity: null,
          category: input.category,
          materials: [],
          estimatedWeightRangeKg: null,
          estimatedDimensionsCm: null,
          confidenceScore: 36,
          evidence: "Used as free-form parcel description.",
        },
      ]
    : [];
}

function buildHandlingNotes(
  fragileLevel: ParcelFragileLevel,
  input: ParcelEstimatorRequest,
) {
  const notes: ParcelHandlingNote[] = [];

  if (fragileLevel === "high") {
    notes.push({
      code: "fragile",
      label: "Fragile handling",
      details: "Use stabilized handling and avoid hard drops.",
    });
  }

  if (input.advancedDetails?.temperatureControlled || input.advancedDetails?.perishable) {
    notes.push({
      code: "temperature_sensitive",
      label: "Temperature sensitive",
      details: "Keep dispatch direct and avoid heat exposure where possible.",
    });
  }

  if (input.advancedDetails?.sealed) {
    notes.push({
      code: "sealed_required",
      label: "Keep sealed",
      details: "Do not open packaging before pickup confirmation.",
    });
  }

  return notes;
}

function buildWeatherSensitivity(
  category: ParcelCategory,
  fragileLevel: ParcelFragileLevel,
  input: ParcelEstimatorRequest,
): ParcelWeatherSensitivity {
  return {
    rain:
      category === "documents" ||
      category === "electronics" ||
      Boolean(input.advancedDetails?.sealed),
    wind: fragileLevel === "high",
    heat:
      category === "food" ||
      category === "medical" ||
      Boolean(input.advancedDetails?.temperatureControlled),
    cold: Boolean(input.advancedDetails?.temperatureControlled),
    humidity: category === "documents" || category === "electronics",
    notes: null,
  };
}

function buildRiskFlags({
  confidenceScore,
  fragileLevel,
  weightRange,
  estimatedDimensions,
  weatherSensitivity,
}: {
  confidenceScore: number;
  fragileLevel: ParcelFragileLevel;
  weightRange: ParcelEstimatedWeightRange;
  estimatedDimensions: ParcelEstimatedDimensions;
  weatherSensitivity: ParcelWeatherSensitivity;
}) {
  const riskFlags: ParcelRiskFlag[] = [];

  if (confidenceScore < 45) {
    riskFlags.push({
      code: "low_confidence",
      severity: "medium",
      label: "Needs one detail",
      reason: "The parcel description is too broad for a high-confidence estimate.",
    });
  }

  if (fragileLevel === "high") {
    riskFlags.push({
      code: "fragile",
      severity: "medium",
      label: "Fragile contents",
      reason: "The parcel may need stabilized handling.",
    });
  }

  if (weightRange.maxKg > maxFleetPayloadKg) {
    riskFlags.push({
      code: "overweight",
      severity: "high",
      label: "Weight over fleet limit",
      reason: `Estimated weight is above ${maxFleetPayloadKg} kg.`,
    });
  }

  if (
    estimatedDimensions.dimensionsCm.lengthCm > 50 ||
    estimatedDimensions.dimensionsCm.widthCm > 40 ||
    estimatedDimensions.dimensionsCm.heightCm > 30
  ) {
    riskFlags.push({
      code: "oversize",
      severity: "medium",
      label: "Large parcel",
      reason: "Dimensions may limit compatible drone lockers.",
    });
  }

  if (
    weatherSensitivity.rain ||
    weatherSensitivity.heat ||
    weatherSensitivity.humidity
  ) {
    riskFlags.push({
      code: "weather_sensitive",
      severity: "low",
      label: "Weather sensitive",
      reason: "Weather can affect handling or packaging quality.",
    });
  }

  return riskFlags;
}

function buildClarificationQuestions(
  input: ParcelEstimatorRequest,
  confidenceScore: number,
  detectedItems: ParcelDetectedItem[],
) {
  const description = getNaturalDescriptionText(input);
  const hasTrustedWeight =
    Boolean(input.advancedDetails?.declaredWeightKg) ||
    parseExplicitParcelWeightKg(description) !== null;
  const questions: ParcelClarificationQuestion[] = [];

  for (const blocking of buildBlockingProductClarifications(toParcelAssistantInput(input))) {
    if (!questions.some((q) => q.id === blocking.id)) {
      questions.push(blocking);
    }
    if (questions.length >= 3) {
      return questions.slice(0, 3);
    }
  }

  if (needsComputerTypeClarification(input)) {
    questions.push({
      id: "clarify_computer_type",
      question: "Este vorba despre un calculator desktop, laptop sau accesorii?",
      field: "contents",
      answerType: "single_select",
      options: [
        { value: "desktop", label: "Calculator desktop / PC" },
        { value: "laptop", label: "Laptop" },
        { value: "accessories", label: "Accesorii" },
      ],
      required: true,
      blocksConfirmation: true,
      reason: "Tipul de calculator schimba greutatea, dimensiunile si modulul recomandat.",
    });
  }

  if (!description || description.length < 8 || detectedItems.length === 0) {
    questions.push({
      id: "clarify_contents",
      question: "Ce obiecte sunt în colet?",
      field: "contents",
      answerType: "text",
      options: [],
      required: true,
      blocksConfirmation: false,
      reason: "A more specific description improves the estimate.",
    });
  }

  if (!hasTrustedWeight && confidenceScore < 60) {
    questions.push({
      id: "clarify_weight",
      question: "Știi aproximativ greutatea coletului?",
      field: "weight",
      answerType: "number",
      options: [],
      required: false,
      blocksConfirmation: false,
      reason: "A declared weight improves drone matching.",
    });
  }

  if (questions.length === 0 && confidenceScore < 45) {
    questions.push({
      id: "clarify_packaging",
      question: "Este într-o cutie rigidă sau într-un ambalaj flexibil?",
      field: "packaging",
      answerType: "single_select",
      options: [
        { value: "boxed", label: "Cutie rigidă" },
        { value: "soft_pouch", label: "Ambalaj flexibil" },
        { value: "plastic_bag", label: "Pungă de plastic" },
      ],
      required: false,
      blocksConfirmation: false,
      reason: "Packaging changes weight and fragile handling assumptions.",
    });
  }

  return questions.slice(0, 3);
}

function buildIntelligenceEstimate({
  input,
  source,
  detectedItems,
  materials,
  packagingInference,
  weightRange,
  estimatedDimensions,
  category,
  fragileLevel,
  confidenceScore,
  confidence,
  handlingNotes,
  weatherSensitivity,
  riskFlags,
  clarificationQuestions,
  recommendedDroneClass,
  explanation,
}: {
  input: ParcelEstimatorRequest;
  source: "openrouter" | "local";
  detectedItems: ParcelDetectedItem[];
  materials: string[];
  packagingInference: ParcelPackagingInference;
  weightRange: ParcelEstimatedWeightRange;
  estimatedDimensions: ParcelEstimatedDimensions;
  category: ParcelCategory;
  fragileLevel: ParcelFragileLevel;
  confidenceScore: number;
  confidence: ParcelEstimatorConfidence;
  handlingNotes: ParcelHandlingNote[];
  weatherSensitivity: ParcelWeatherSensitivity;
  riskFlags: ParcelRiskFlag[];
  clarificationQuestions: ParcelClarificationQuestion[];
  recommendedDroneClass: DroneClass;
  explanation: string;
}): ParcelIntelligenceEstimate {
  return {
    naturalDescription: input.naturalDescription ?? {
      text: getNaturalDescriptionText(input),
      locale: "ro-RO",
      source: "customer",
      capturedAt: null,
    },
    advancedDetails: input.advancedDetails ?? null,
    detectedItems,
    packagingInference,
    estimatedWeightRange: {
      ...weightRange,
      source,
    },
    estimatedDimensions: {
      ...estimatedDimensions,
      source,
    },
    volumeLiters: estimatedDimensions.volumeLiters,
    category,
    approximateSize: input.approximateSize,
    fragility: fragileLevel,
    handlingNotes,
    weatherSensitivity,
    riskFlags,
    confidenceScore,
    confidence,
    clarificationQuestions,
    previousClarificationAnswers: input.previousClarificationAnswers ?? [],
    recommendedDroneClass,
    objectProfiles: detectedItems,
    finalParcelProfile: {
      weightRange,
      dimensions: estimatedDimensions,
      packagingMaterialNotes: materials,
    },
    contradictions: [],
    uncertainties: confidenceScore < 60 ? [{
      field: "parcel_weight",
      message: "Greutatea finală rămâne o estimare până la confirmarea la ridicare.",
      severity: confidenceScore < 45 ? "high" : "medium",
    }] : [],
    explanation: materials.length
      ? `${explanation} Materials: ${materials.join(", ")}.`
      : explanation,
  };
}

function buildLocalEstimate(input: ParcelEstimatorRequest): ParcelEstimatorResponse {
  const assistantInput = toParcelAssistantInput(input);
  const semanticEstimate = getSemanticParcelEstimate(assistantInput);
  const localEstimate = getLocalParcelAssistantResult(assistantInput);
  const localWeight = parseWeightRange(localEstimate.estimatedWeightRange);
  const description = getNaturalDescriptionText(input);
  const explicitWeightKg = parseExplicitParcelWeightKg(description);
  const liquidVolume = parseLiquidVolumeLiters(description);
  const physicalBounds = getDeterministicParcelWeightBounds(assistantInput);
  const declaredWeightKg = input.advancedDetails?.declaredWeightKg;
  const source: ParcelEstimatedWeightRange["source"] =
    declaredWeightKg && declaredWeightKg > 0
      ? "user_declared"
      : explicitWeightKg !== null ||
          physicalBounds?.reason === "explicit_weight" ||
          physicalBounds?.reason === "declared_weight"
        ? "user_declared"
        : "local";
  const estimatedWeightMin =
    declaredWeightKg && declaredWeightKg > 0
      ? declaredWeightKg
      : explicitWeightKg !== null
        ? explicitWeightKg
        : physicalBounds
          ? physicalBounds.minKg
          : Number(localWeight.min.toFixed(1));
  const estimatedWeightMax =
    declaredWeightKg && declaredWeightKg > 0
      ? declaredWeightKg
      : explicitWeightKg !== null
        ? explicitWeightKg
        : physicalBounds
          ? physicalBounds.maxKg
          : Number(Math.max(localWeight.max, localWeight.min + 0.1).toFixed(1));
  const suggestedDimensionsCm =
    input.advancedDetails?.declaredDimensionsCm ??
    localEstimate.suggestedDimensionsCm ??
    null;
  const estimatedDimensions = buildEstimatedDimensions(
    suggestedDimensionsCm ?? { lengthCm: 30, widthCm: 20, heightCm: 10 },
    input.advancedDetails?.declaredDimensionsCm ? "user_declared" : "local",
  );
  const detectedItems = buildDetectedItems(input, assistantInput);
  const materials = Array.from(
    new Set(detectedItems.flatMap((item) => item.materials ?? [])),
  );
  const category = semanticEstimate?.category ?? input.category;
  const baseConfidenceScore =
    declaredWeightKg || explicitWeightKg !== null
      ? 92
      : semanticEstimate
        ? 86
        : description.length >= 12
          ? 58
          : 32;
  const confidenceScore = needsComputerTypeClarification(input)
    ? Math.min(baseConfidenceScore, 62)
    : baseConfidenceScore;
  const confidence = confidenceFromScore(confidenceScore);
  const packagingInference = parsePackagingInference(
    null,
    getEffectivePackaging(input),
    "Packaging inferred from selected parcel packaging and description.",
    confidence,
  );
  const handlingNotes = buildHandlingNotes(localEstimate.fragileLevel, input);
  const weatherSensitivity = buildWeatherSensitivity(
    category,
    localEstimate.fragileLevel,
    input,
  );
  const weightRange = buildWeightRange(estimatedWeightMin, estimatedWeightMax, source);
  const riskFlags = buildRiskFlags({
    confidenceScore,
    fragileLevel: localEstimate.fragileLevel,
    weightRange,
    estimatedDimensions,
    weatherSensitivity,
  });
  const clarificationQuestions = buildClarificationQuestions(
    input,
    confidenceScore,
    detectedItems,
  );
  const intelligenceEstimate = buildIntelligenceEstimate({
    input,
    source: "local",
    detectedItems,
    materials,
    packagingInference,
    weightRange,
    estimatedDimensions,
    category,
    fragileLevel: localEstimate.fragileLevel,
    confidenceScore,
    confidence,
    handlingNotes,
    weatherSensitivity,
    riskFlags,
    clarificationQuestions,
    recommendedDroneClass: localEstimate.suggestedDroneClass,
    explanation: localEstimate.confidenceNote,
  });

  return {
    source: "local",
    detectedItems: detectedItems.length
      ? detectedItems.map((item) => item.label)
      : description
        ? [description]
        : ["parcel contents"],
    detectedItemsDetailed: detectedItems,
    estimatedWeightMin: weightRange.minKg,
    estimatedWeightMax: weightRange.maxKg,
    estimatedWeightRange: weightRange,
    suggestedDimensionsCm,
    estimatedDimensions,
    volumeLiters: liquidVolume?.totalLiters ?? estimatedDimensions.volumeLiters,
    confidence,
    confidenceScore,
    fragileLevel: localEstimate.fragileLevel,
    category,
    materials: materials.length ? materials : ["standard packaging materials"],
    packagingAssumption: packagingInference.assumption,
    packagingInference,
    handlingNotes,
    weatherSensitivity,
    riskFlags,
    clarificationQuestions,
    previousClarificationAnswers: input.previousClarificationAnswers ?? [],
    recommendedDroneClass: localEstimate.suggestedDroneClass,
    explanation: localEstimate.confidenceNote,
    intelligence: {
      status: clarificationQuestions.length
        ? "needs_clarification"
        : "ready_for_confirmation",
      estimate: intelligenceEstimate,
      confirmation: null,
      confirmedProfile: null,
    },
    safetyNote,
  };
}

function withProviderTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("[ai] Parcel intelligence provider timed out."));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

function combineWithLocalSafety(
  input: ParcelEstimatorRequest,
  estimate: RawParcelEstimate,
): ParcelEstimatorResponse {
  const assistantInput = toParcelAssistantInput(input);
  const semanticEstimate = getSemanticParcelEstimate(assistantInput);
  const localEstimate = buildLocalEstimate(input);
  const physicalBounds = getDeterministicParcelWeightBounds(assistantInput);
  const physicalLiquidVolume =
    physicalBounds?.reason === "liquid_volume"
      ? parseLiquidVolumeLiters(getNaturalDescriptionText(input))
      : null;
  const explicitWeightKg = parseExplicitParcelWeightKg(getNaturalDescriptionText(input));
  const declaredWeightKg = input.advancedDetails?.declaredWeightKg;
  const aiWeight = {
    min: estimate.estimatedWeightMin,
    max: estimate.estimatedWeightMax,
  };
  const aiBelowPhysicalBounds = physicalBounds
    ? hasWeightBelowBounds(aiWeight, physicalBounds)
    : false;
  const aiWildlyAbovePhysicalBounds = physicalBounds
    ? hasWeightWildlyAboveBounds(aiWeight, physicalBounds)
    : false;
  const aiConflictsWithPhysicalRules =
    aiBelowPhysicalBounds || aiWildlyAbovePhysicalBounds;
  const clampedWeight = clampWeightToBaseline(
    aiWeight,
    {
      min: localEstimate.estimatedWeightMin,
      max: localEstimate.estimatedWeightMax,
    },
    explicitWeightKg,
    declaredWeightKg,
  );
  const physicalWeightSource: ParcelEstimatedWeightRange["source"] =
    physicalBounds?.reason === "declared_weight" ||
    physicalBounds?.reason === "explicit_weight"
      ? "user_declared"
      : "local";
  const weightRange = physicalBounds
    ? buildWeightRange(
        physicalBounds.minKg,
        physicalBounds.maxKg,
        physicalWeightSource,
      )
    : estimate.estimatedWeightRange ??
      buildWeightRange(clampedWeight.min, clampedWeight.max, "openrouter");
  const suggestedDimensionsCm =
    input.advancedDetails?.declaredDimensionsCm ??
    (semanticEstimate ? localEstimate.suggestedDimensionsCm : null) ??
    estimate.suggestedDimensionsCm ??
    localEstimate.suggestedDimensionsCm;
  const estimatedDimensions =
    input.advancedDetails?.declaredDimensionsCm
      ? buildEstimatedDimensions(input.advancedDetails.declaredDimensionsCm, "user_declared")
      : semanticEstimate
        ? localEstimate.estimatedDimensions
        : estimate.estimatedDimensions ??
          (suggestedDimensionsCm
            ? buildEstimatedDimensions(suggestedDimensionsCm, "openrouter")
            : localEstimate.estimatedDimensions);
  const baseConfidenceScore = physicalBounds
    ? localEstimate.confidenceScore ?? 86
    : estimate.confidenceScore ?? toConfidenceScore(estimate.confidence);
  const physicalAdjustedConfidenceScore = aiConflictsWithPhysicalRules
    ? Math.min(baseConfidenceScore, 70)
    : baseConfidenceScore;
  const confidenceScore = needsComputerTypeClarification(input)
    ? Math.min(physicalAdjustedConfidenceScore, 62)
    : physicalAdjustedConfidenceScore;
  const confidence = confidenceFromScore(confidenceScore);
  const fragileLevel = getHigherFragileLevel(
    toParcelFragileLevel(estimate.fragileLevel),
    localEstimate.fragileLevel,
  );
  const category = semanticEstimate?.category ?? estimate.category ?? localEstimate.category ?? input.category;
  const packagingInference = parsePackagingInference(
    estimate.packagingInference,
    getEffectivePackaging(input),
    estimate.packagingAssumption || localEstimate.packagingAssumption,
    confidence,
  );
  const detectedItems =
    semanticEstimate || physicalBounds
      ? localEstimate.detectedItemsDetailed ?? []
      : estimate.detectedItemsDetailed?.length
        ? estimate.detectedItemsDetailed
        : localEstimate.detectedItemsDetailed ?? [];
  const materials = estimate.materials.length
    ? estimate.materials
    : localEstimate.materials;
  const handlingNotes = parseHandlingNotes(
    estimate.handlingNotes,
    localEstimate.handlingNotes ?? [],
  );
  const weatherSensitivity = parseWeatherSensitivity(
    estimate.weatherSensitivity,
    localEstimate.weatherSensitivity ?? {},
  );
  const riskFlags = parseRiskFlags(
    estimate.riskFlags,
    buildRiskFlags({
      confidenceScore,
      fragileLevel,
      weightRange,
      estimatedDimensions: estimatedDimensions ?? localEstimate.estimatedDimensions!,
      weatherSensitivity,
    }),
  );
  const fallbackQuestions = buildClarificationQuestions(input, confidenceScore, detectedItems);
  const clarificationQuestions =
    confidenceScore < 45 || fallbackQuestions.length
      ? parseClarificationQuestions(estimate.clarificationQuestions, fallbackQuestions)
      : [];
  const resolvedEstimatedDimensions =
    estimatedDimensions ?? localEstimate.estimatedDimensions!;
  const recommendedDroneClass = getRecommendedDroneClassForEstimate({
    weightRange,
    estimatedDimensions: resolvedEstimatedDimensions,
    fragileLevel,
    fallback: physicalBounds
      ? localEstimate.recommendedDroneClass
      : estimate.recommendedDroneClass,
  });
  const baseExplanation =
    physicalBounds || !estimate.explanation
      ? localEstimate.explanation
      : estimate.explanation;
  const explanation = appendExplanationNote(
    baseExplanation,
    aiConflictsWithPhysicalRules ? physicalBounds?.correctionNote : undefined,
  );
  const corrections: ParcelEstimatorCorrection[] =
    physicalBounds && aiConflictsWithPhysicalRules
      ? [
          {
            code:
              physicalBounds.reason === "liquid_volume"
                ? "liquid_volume"
                : physicalBounds.reason === "declared_weight" ||
                    physicalBounds.reason === "explicit_weight"
                  ? "explicit_weight"
                  : "physical_bounds",
            message: buildCorrectionMessage({
              reason: physicalBounds.reason,
              detectedVolumeLiters: physicalLiquidVolume?.totalLiters ?? null,
              fallbackNote: physicalBounds.correctionNote,
            }),
            detectedVolumeLiters: physicalLiquidVolume?.totalLiters ?? null,
            detectedVolumeLabel: physicalLiquidVolume
              ? `${formatVolumeLiters(physicalLiquidVolume.totalLiters)} L`
              : null,
            originalWeightRange: buildWeightRange(
              aiWeight.min,
              aiWeight.max,
              "openrouter",
            ),
            correctedWeightRange: weightRange,
            confidenceAdjusted: true,
          },
        ]
      : [];
  const intelligenceEstimate = buildIntelligenceEstimate({
    input,
    source: "openrouter",
    detectedItems,
    materials,
    packagingInference,
    weightRange,
    estimatedDimensions: resolvedEstimatedDimensions,
    category,
    fragileLevel,
    confidenceScore,
    confidence,
    handlingNotes,
    weatherSensitivity,
    riskFlags,
    clarificationQuestions,
    recommendedDroneClass,
    explanation,
  });

  return {
    source: "openrouter",
    detectedItems: detectedItems.length
      ? detectedItems.map((item) => item.label)
      : estimate.detectedItems.length
        ? estimate.detectedItems
        : localEstimate.detectedItems,
    detectedItemsDetailed: detectedItems,
    estimatedWeightMin: weightRange.minKg,
    estimatedWeightMax: weightRange.maxKg,
    estimatedWeightRange: weightRange,
    suggestedDimensionsCm,
    estimatedDimensions,
    volumeLiters:
      physicalLiquidVolume?.totalLiters ??
      estimate.volumeLiters ??
      estimatedDimensions?.volumeLiters ??
      localEstimate.volumeLiters,
    confidence,
    confidenceScore,
    fragileLevel,
    category,
    materials,
    packagingAssumption: packagingInference.assumption,
    packagingInference,
    handlingNotes,
    weatherSensitivity,
    riskFlags,
    clarificationQuestions,
    previousClarificationAnswers: input.previousClarificationAnswers ?? [],
    recommendedDroneClass,
    explanation,
    corrections,
    intelligence: {
      status: clarificationQuestions.length
        ? "needs_clarification"
        : "ready_for_confirmation",
      estimate: intelligenceEstimate,
      confirmation: null,
      confirmedProfile: null,
    },
    safetyNote,
  };
}

function evidenceConfidenceFromScore(score: number): ParcelIntelligenceConfidenceLevel {
  if (score >= 0.7) {
    return "high";
  }
  if (score >= 0.4) {
    return "medium";
  }
  return "low";
}

function tokenizeForMatch(value: string): Set<string> {
  return new Set(
    normalizeSearchText(value)
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 3),
  );
}

const PHONE_BRAND_TOKENS = new Set([
  "iphone",
  "samsung",
  "galaxy",
  "pixel",
  "xiaomi",
  "huawei",
  "oneplus",
  "macbook",
]);

const LAPTOP_BRAND_TOKENS = new Set([
  "macbook",
  "asus",
  "lenovo",
  "dell",
  "hp",
  "acer",
  "razer",
  "thinkpad",
  "vivobook",
  "ideapad",
  "inspiron",
  "surface",
  "zenbook",
  "elitebook",
]);

function isPhoneLabel(label: string): boolean {
  return /telefon|smartphone|phone|mobil|iphone/i.test(label);
}

function isLaptopLabel(label: string): boolean {
  return /laptop|notebook|ultrabook/i.test(label);
}

function evidenceMatchesItem(label: string, titleTokens: Set<string>): boolean {
  if (titleTokens.size === 0) {
    return false;
  }
  const labelTokens = tokenizeForMatch(label);
  for (const token of titleTokens) {
    if (labelTokens.has(token)) {
      return true;
    }
  }
  if (isPhoneLabel(label)) {
    for (const token of titleTokens) {
      if (PHONE_BRAND_TOKENS.has(token)) {
        return true;
      }
    }
  }
  if (isLaptopLabel(label)) {
    for (const token of titleTokens) {
      if (LAPTOP_BRAND_TOKENS.has(token)) {
        return true;
      }
    }
  }
  return false;
}

function attachLookupEvidenceToItems(
  items: ParcelDetectedItem[],
  results: ProductLookupResult[],
): ParcelDetectedItem[] {
  if (!results.length || !items.length) {
    return items;
  }

  const resultTokens = results.map((result) => ({
    result,
    tokens: tokenizeForMatch(`${result.title} ${result.url}`),
  }));

  return items.map((item) => {
    const matched = resultTokens
      .filter(({ tokens }) => evidenceMatchesItem(item.label, tokens))
      .map(({ result }) => result);

    if (!matched.length) {
      return item;
    }

    const bestScore = Math.max(...matched.map((result) => result.confidence));
    return {
      ...item,
      sourceUrls: matched.map((result) => result.url),
      lookupEvidence: matched,
      evidenceConfidence: evidenceConfidenceFromScore(bestScore),
    };
  });
}

function attachLookupToResponse(
  response: ParcelEstimatorResponse,
  trace: ParcelLookupTrace,
  results: ProductLookupResult[],
  usedInPrompt: boolean,
): ParcelEstimatorResponse {
  const stampedTrace: ParcelLookupTrace = { ...trace, usedInPrompt };
  const detectedItemsDetailed = attachLookupEvidenceToItems(
    response.detectedItemsDetailed ?? [],
    results,
  );

  const intelligence = response.intelligence
    ? {
        ...response.intelligence,
        estimate: response.intelligence.estimate
          ? {
              ...response.intelligence.estimate,
              lookupTrace: stampedTrace,
              detectedItems: detectedItemsDetailed,
            }
          : response.intelligence.estimate,
      }
    : response.intelligence;

  return {
    ...response,
    detectedItemsDetailed,
    lookupTrace: stampedTrace,
    intelligence,
  };
}

export async function estimateParcelForDispatch(
  input: ParcelEstimatorRequest,
): Promise<ParcelEstimatorResponse> {
  const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || "openrouter";

  const preview = buildLocalEstimate(input);
  const lookup = await runProductLookupForEstimate(
    input,
    preview.detectedItemsDetailed ?? [],
  );

  if (provider !== "openrouter") {
    return {
      ...attachLookupToResponse(
      buildLocalEstimate(input),
      lookup.trace,
      lookup.results,
      false,
      ),
      imageAnalysis: { analyzedImageIds: [], skipped: Boolean(input.images?.length), reason: input.images?.length ? "provider_not_openrouter" : null },
    };
  }

  let rawEstimate: unknown;

  try {
    rawEstimate = await withProviderTimeout(
      estimateParcelWithOpenRouter(input, lookup.results),
      12_000,
    );
  } catch {
    return {
      ...attachLookupToResponse(
      buildLocalEstimate(input),
      lookup.trace,
      lookup.results,
      false,
      ),
      imageAnalysis: { analyzedImageIds: [], skipped: Boolean(input.images?.length), reason: input.images?.length ? "vision_unavailable" : null },
    };
  }

  const parsedEstimate = parseRawParcelEstimate(rawEstimate);

  if (!parsedEstimate) {
    return {
      ...attachLookupToResponse(
      buildLocalEstimate(input),
      lookup.trace,
      lookup.results,
      false,
      ),
      imageAnalysis: { analyzedImageIds: [], skipped: Boolean(input.images?.length), reason: input.images?.length ? "vision_invalid_response" : null },
    };
  }

  const catalogEvidence = await lookupExactCatalogProducts(parsedEstimate.detectedItemsDetailed ?? []);
  let finalEstimate = parsedEstimate;
  if (catalogEvidence.length) {
    try {
      const refined = await withProviderTimeout(
        estimateParcelWithOpenRouter(input, [...lookup.results, ...catalogEvidence]),
        12_000,
      );
      finalEstimate = parseRawParcelEstimate(refined) ?? parsedEstimate;
    } catch {
      // Catalog enrichment is optional; preserve the first multimodal result.
    }
  }
  const allEvidence = [...lookup.results, ...catalogEvidence];
  const response = attachLookupToResponse(
    combineWithLocalSafety(input, finalEstimate),
    lookup.trace,
    allEvidence,
    allEvidence.length > 0,
  );
  return {
    ...response,
    detectedItemsDetailed: response.detectedItemsDetailed?.map((item) => input.images?.length ? { ...item, profileSource: "vision" as const } : item),
    imageAnalysis: { analyzedImageIds: input.images?.map((image) => image.id) ?? [], skipped: false, reason: null },
  };
}
