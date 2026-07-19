import { droneClassLabels } from "@/constants/domain";
import {
  parcelFragileLevelLabels,
  parcelSizeDimensions,
  parcelPackagingLabels,
  parcelPackagingOptions,
  parcelSizeLabels,
  parcelSizeOptions,
} from "@/constants/parcel-assistant";
import { droneFleet } from "@/constants/drone-fleet";
import { getLocalParcelAssistantResult } from "@/lib/parcel-assistant";
import { getRecommendedDrone } from "@/lib/drone-recommendation";
import type { DroneClass } from "@/types/domain";
import type { ParcelDimensions } from "@/types/drone";
import type {
  ConfirmedParcelProfile,
  ParcelEstimatedWeightRange,
  ParcelIntelligenceSnapshot,
} from "@/types/parcel-intelligence";
import type {
  ParcelAssistantInput,
  ParcelAssistantResult,
  ParcelCategory,
  ParcelFragileLevel,
  ParcelPackagingType,
  ParcelSizeOption,
} from "@/types/parcel-assistant";
import type { Option } from "@/types/ui";

export type CreateDeliveryParcelDraft = {
  category: ParcelCategory;
  packaging: ParcelPackagingType;
  approximateSize: ParcelSizeOption;
  contentDescription: string;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  fragilityLevel: ParcelFragileLevel;
  recommendedDroneClass: DroneClass;
  valueSource: "manual" | "assistant";
  assistantResult?: ParcelAssistantResult | null;
  intelligence?: ParcelIntelligenceSnapshot | null;
  confirmedProfile?: ConfirmedParcelProfile | null;
};

export type ParcelValidation = {
  isValid: boolean;
  weightMessage: string;
  dimensionsMessage: string | null;
};

export const parcelCategoryLabels: Record<ParcelCategory, string> = {
  documents: "Documente",
  retail: "Colet retail",
  food: "Livrare mâncare",
  medical: "Medical",
  electronics: "Electronice",
  special: "Manipulare specială",
};

export const parcelCategoryDescriptions: Record<ParcelCategory, string> = {
  documents: "Acte, contracte, documente de identitate sau predări administrative ușoare.",
  retail: "Comenzi de magazin, pachete de produse sau colete compacte.",
  food: "Mâncare preparată, cumpărături sau predări care țin cont de temperatură.",
  medical: "Produse de farmacie, probe sau articole sensibile controlate.",
  electronics: "Accesorii, periferice sau colete compacte cu tehnologie.",
  special: "Încărcâturi atipice care au nevoie de context suplimentar înainte de dispatch.",
};

export const parcelCategoryOptions: Option<ParcelCategory>[] = [
  { label: parcelCategoryLabels.documents, value: "documents" },
  { label: parcelCategoryLabels.retail, value: "retail" },
  { label: parcelCategoryLabels.food, value: "food" },
  { label: parcelCategoryLabels.medical, value: "medical" },
  { label: parcelCategoryLabels.electronics, value: "electronics" },
  { label: parcelCategoryLabels.special, value: "special" },
];

export const defaultCreateDeliveryParcelDraft: CreateDeliveryParcelDraft = {
  category: "retail",
  packaging: "boxed",
  approximateSize: "small",
  contentDescription: "",
  weightKg: null,
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  fragilityLevel: "low",
  recommendedDroneClass: "medium_standard",
  valueSource: "manual",
};

export function toParcelAssistantInput(
  draft: CreateDeliveryParcelDraft,
): ParcelAssistantInput {
  return {
    contents: draft.contentDescription,
    category: draft.category,
    packaging: draft.packaging,
    approximateSize: draft.approximateSize,
    fragilityLevel: draft.fragilityLevel,
  };
}

export function fromParcelAssistantInput(
  input: ParcelAssistantInput,
  assistantResult?: ParcelAssistantResult | null,
  currentDraft?: CreateDeliveryParcelDraft,
): CreateDeliveryParcelDraft {
  const defaultDimensions = parcelSizeDimensions[input.approximateSize];
  const assistantDimensions =
    assistantResult?.suggestedDimensionsCm ?? defaultDimensions;
  const assistantWeight =
    assistantResult?.estimatedWeightKg ??
    parseWeightRangeMidpoint(assistantResult?.estimatedWeightRange ?? "");
  const confirmedProfile = assistantResult
    ? buildConfirmedParcelProfile(input, assistantResult, {
        weightKg: assistantWeight,
        dimensionsCm: assistantDimensions,
      })
    : null;
  const intelligence = assistantResult
    ? buildConfirmedParcelIntelligenceSnapshot(assistantResult, confirmedProfile)
    : null;

  return {
    ...(currentDraft ?? defaultCreateDeliveryParcelDraft),
    category: input.category ?? currentDraft?.category ?? defaultCreateDeliveryParcelDraft.category,
    packaging: input.packaging,
    approximateSize: input.approximateSize,
    contentDescription: input.contents,
    weightKg: assistantWeight,
    lengthCm: assistantDimensions.lengthCm,
    widthCm: assistantDimensions.widthCm,
    heightCm: assistantDimensions.heightCm,
    fragilityLevel:
      assistantResult?.fragileLevel ??
      input.fragilityLevel ??
      currentDraft?.fragilityLevel ??
      "moderate",
    recommendedDroneClass:
      assistantResult?.suggestedDroneClass ??
      currentDraft?.recommendedDroneClass ??
      "medium_standard",
    valueSource: "assistant",
    assistantResult: assistantResult ?? null,
    intelligence,
    confirmedProfile,
  };
}

function buildEstimatedWeightRange(
  assistantResult: ParcelAssistantResult,
  weightKg: number | null,
): ParcelEstimatedWeightRange {
  const parsedMidpoint =
    weightKg ?? parseWeightRangeMidpoint(assistantResult.estimatedWeightRange);

  return {
    minKg: parsedMidpoint ?? 0,
    maxKg: parsedMidpoint ?? 0,
    midpointKg: parsedMidpoint,
    label: assistantResult.estimatedWeightRange,
    source: "operator",
  };
}

function buildConfirmedParcelProfile(
  input: ParcelAssistantInput,
  assistantResult: ParcelAssistantResult,
  {
    weightKg,
    dimensionsCm,
  }: {
    weightKg: number | null;
    dimensionsCm: ParcelDimensions;
  },
): ConfirmedParcelProfile {
  const estimate = assistantResult.intelligence?.estimate ?? null;
  const volumeLiters = Number(
    ((dimensionsCm.lengthCm * dimensionsCm.widthCm * dimensionsCm.heightCm) / 1000).toFixed(1),
  );

  return {
    naturalDescription:
      input.naturalDescription ??
      estimate?.naturalDescription ?? {
        text: input.contents,
        locale: "ro-RO",
        source: "customer",
        capturedAt: null,
      },
    advancedDetails: input.advancedDetails ?? estimate?.advancedDetails ?? null,
    detectedItems: estimate?.detectedItems ?? [],
    packaging: input.packaging,
    packagingInference: estimate?.packagingInference ?? null,
    estimatedWeightRange: buildEstimatedWeightRange(assistantResult, weightKg),
    estimatedDimensions: {
      dimensionsCm,
      volumeLiters,
      source: "operator",
      fitNotes: estimate?.estimatedDimensions?.fitNotes ?? [],
    },
    volumeLiters,
    category: input.category ?? estimate?.category ?? defaultCreateDeliveryParcelDraft.category,
    approximateSize:
      input.approximateSize ??
      estimate?.approximateSize ??
      defaultCreateDeliveryParcelDraft.approximateSize,
    fragility: assistantResult.fragileLevel,
    handlingNotes: estimate?.handlingNotes ?? [],
    weatherSensitivity: estimate?.weatherSensitivity ?? {},
    riskFlags: estimate?.riskFlags ?? [],
    confidenceScore: estimate?.confidenceScore ?? 100,
    confidence: estimate?.confidence ?? "high",
    recommendedDroneClass: assistantResult.suggestedDroneClass,
    confirmedAt: new Date().toISOString(),
    confirmedBy: "customer",
  };
}

function buildConfirmedParcelIntelligenceSnapshot(
  assistantResult: ParcelAssistantResult,
  confirmedProfile: ConfirmedParcelProfile | null,
): ParcelIntelligenceSnapshot {
  return {
    status: "confirmed",
    estimate: assistantResult.intelligence?.estimate ?? null,
    confirmation: assistantResult.intelligence?.confirmation ?? null,
    confirmedProfile,
  };
}

export function isCreateDeliveryParcelConfirmed(
  draft: CreateDeliveryParcelDraft,
) {
  return Boolean(getCreateDeliveryConfirmedParcelProfile(draft));
}

export function getCreateDeliveryConfirmedParcelProfile(
  draft: CreateDeliveryParcelDraft,
) {
  const confirmedProfile =
    draft.confirmedProfile ??
    draft.intelligence?.confirmedProfile ??
    draft.assistantResult?.confirmedProfile ??
    null;

  return draft.intelligence?.status === "confirmed" ? confirmedProfile : null;
}

export function isCreateDeliveryParcelLowConfidence(
  draft: CreateDeliveryParcelDraft,
) {
  return getCreateDeliveryConfirmedParcelProfile(draft)?.confidence === "low";
}

export function isCreateDeliveryParcelReadyForConfiguration(
  draft: CreateDeliveryParcelDraft,
) {
  return (
    isCreateDeliveryParcelConfirmed(draft) &&
    !isCreateDeliveryParcelLowConfidence(draft)
  );
}

export function getCreateDeliveryParcelGuidance(
  draft: CreateDeliveryParcelDraft,
): ParcelAssistantResult {
  const recommendedDroneClass = getRecommendedDroneClassForParcel(draft);
  const estimatedWeightRange = draft.weightKg
    ? `${draft.weightKg.toFixed(1)} kg`
    : (draft.assistantResult?.estimatedWeightRange ??
      getLocalParcelAssistantResult(toParcelAssistantInput(draft)).estimatedWeightRange);

  return {
    estimatedWeightRange,
    estimatedWeightKg: draft.weightKg,
    suggestedDimensionsCm: getParcelDimensions(draft),
    fragileLevel: draft.fragilityLevel,
    suggestedDroneClass: recommendedDroneClass,
    clarificationQuestions: draft.assistantResult?.clarificationQuestions ?? [],
    intelligence: draft.intelligence ?? draft.assistantResult?.intelligence ?? null,
    confirmedProfile:
      draft.confirmedProfile ?? draft.assistantResult?.confirmedProfile ?? null,
    confidenceNote:
      draft.valueSource === "assistant"
        ? "Actualizat de asistent. Poți edita manual înainte de verificare."
        : "Editat manual. Aceste valori sunt folosite pentru potrivirea dronei și tarif.",
  };
}

export function getParcelGuidanceTone(
  fragileLevel: ParcelAssistantResult["fragileLevel"],
) {
  if (fragileLevel === "high") {
    return "warning" as const;
  }

  if (fragileLevel === "moderate") {
    return "info" as const;
  }

  return "success" as const;
}

export function getParcelGuidanceSummaryLines(
  draft: CreateDeliveryParcelDraft,
  result: ParcelAssistantResult,
) {
  return [
    `Categorie: ${parcelCategoryLabels[draft.category]}`,
    `Ambalaj: ${parcelPackagingLabels[draft.packaging]}`,
    `Mărime: ${parcelSizeLabels[draft.approximateSize]}`,
    `Greutate estimată: ${result.estimatedWeightRange}`,
    `Fragilitate: ${parcelFragileLevelLabels[result.fragileLevel]}`,
    `Dronă recomandată: ${droneClassLabels[result.suggestedDroneClass]}`,
  ];
}

export function parseWeightRangeMidpoint(range: string) {
  const values = range
    .replace(",", ".")
    .match(/\d+(?:\.\d+)?/g)
    ?.map(Number)
    .filter((value) => Number.isFinite(value));

  if (!values?.length) {
    return null;
  }

  if (values.length === 1) {
    return Number(values[0].toFixed(1));
  }

  return Number(((values[0] + values[1]) / 2).toFixed(1));
}

export function getFleetMaxPayloadKg() {
  return Math.max(...droneFleet.map((drone) => drone.maxPayloadKg));
}

export function getParcelDimensions(
  draft: CreateDeliveryParcelDraft,
): ParcelDimensions {
  return {
    lengthCm: draft.lengthCm ?? parcelSizeDimensions[draft.approximateSize].lengthCm,
    widthCm: draft.widthCm ?? parcelSizeDimensions[draft.approximateSize].widthCm,
    heightCm: draft.heightCm ?? parcelSizeDimensions[draft.approximateSize].heightCm,
  };
}

export function getRecommendedDroneClassForParcel(
  draft: CreateDeliveryParcelDraft,
) {
  if (!draft.weightKg || draft.weightKg <= 0) {
    return draft.recommendedDroneClass;
  }

  return (
    getRecommendedDrone({
      payloadKg: draft.weightKg,
      parcelDimensionsCm: getParcelDimensions(draft),
      deliveryDistanceKm: 12,
      urgency: draft.fragilityLevel === "high" ? "priority" : "standard",
      requiresFragileHandling: draft.fragilityLevel === "high",
    })?.id ??
    draft.recommendedDroneClass ??
    "heavy_cargo"
  );
}

export function validateCreateDeliveryParcel(
  draft: CreateDeliveryParcelDraft,
): ParcelValidation {
  const maxPayloadKg = getFleetMaxPayloadKg();
  const isConfirmed = isCreateDeliveryParcelConfirmed(draft);
  const isReadyForConfiguration =
    isCreateDeliveryParcelReadyForConfiguration(draft);
  let weightMessage: string;

  if (!isConfirmed) {
    weightMessage = "Confirmă profilul coletului înainte de a continua.";
  } else if (!isReadyForConfiguration) {
    weightMessage =
      "Raspunde la clarificari pentru profilul cu incredere scazuta.";
  } else if (!draft.weightKg || Number.isNaN(draft.weightKg)) {
    weightMessage = "Adaugă greutatea coletului înainte de a continua.";
  } else if (draft.weightKg <= 0) {
    weightMessage = "Greutatea trebuie să fie mai mare de 0 kg.";
  } else if (draft.weightKg > maxPayloadKg) {
    weightMessage = `Greutatea depășește limita curentă a flotei de ${maxPayloadKg} kg.`;
  } else {
    weightMessage = "Greutatea este pregătită pentru potrivirea dronei.";
  }
  const dimensionValues = [draft.lengthCm, draft.widthCm, draft.heightCm];
  const hasAnyDimension = dimensionValues.some((value) => value !== null);
  const hasAllDimensions = dimensionValues.every(
    (value) => typeof value === "number" && Number.isFinite(value) && value > 0,
  );
  const hasInvalidDimension = dimensionValues.some(
    (value) => value !== null && (!Number.isFinite(value) || value <= 0),
  );
  let dimensionsMessage: string | null;

  if (!isConfirmed) {
    dimensionsMessage =
      "Confirmă estimarea AI sau editează manual profilul înainte de continuare.";
  } else if (!isReadyForConfiguration) {
    dimensionsMessage =
      "Profilul cu incredere scazuta are nevoie de clarificari inainte de potrivirea automata.";
  } else if (hasInvalidDimension) {
    dimensionsMessage =
      "Dimensiunile trebuie să fie pozitive când sunt completate.";
  } else if (!hasAllDimensions) {
    dimensionsMessage =
      "Confirmă dimensiunile coletului înainte de potrivirea dronei.";
  } else if (hasAnyDimension) {
    dimensionsMessage = "Dimensiunile vor rafina potrivirea dronei.";
  } else {
    dimensionsMessage = null;
  }

  return {
    isValid:
      isReadyForConfiguration &&
      Boolean(draft.weightKg) &&
      Number.isFinite(draft.weightKg) &&
      draft.weightKg !== null &&
      draft.weightKg > 0 &&
      draft.weightKg <= maxPayloadKg &&
      hasAllDimensions &&
      !hasInvalidDimension,
    weightMessage,
    dimensionsMessage,
  };
}

export {
  droneClassLabels,
  parcelFragileLevelLabels,
  parcelPackagingLabels,
  parcelPackagingOptions,
  parcelSizeLabels,
  parcelSizeOptions,
};
