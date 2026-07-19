import { droneClassLabels } from "@/constants/domain";
import {
  parcelFragileLevelLabels,
  parcelSizeDimensions,
  parcelSizeWeightRanges,
} from "@/constants/parcel-assistant";
import { getRecommendedDrone } from "@/lib/drone-recommendation";
import type {
  ParcelAssistantInput,
  ParcelAssistantResult,
  ParcelCategory,
  ParcelClarificationQuestion,
  ParcelFragileLevel,
  ParcelPackagingType,
  ParcelSizeOption,
} from "@/types/parcel-assistant";

const sizeOrder: readonly ParcelSizeOption[] = [
  "extra_small",
  "small",
  "medium",
  "large",
] as const;

const fragileLevelPriority: readonly ParcelFragileLevel[] = [
  "low",
  "moderate",
  "high",
] as const;

const sizeProfiles: Record<
  ParcelSizeOption,
  {
    midpointKg: number;
    distanceKm: number;
  }
> = {
  extra_small: {
    midpointKg: 0.5,
    distanceKm: 6,
  },
  small: {
    midpointKg: 1.2,
    distanceKm: 8,
  },
  medium: {
    midpointKg: 2.7,
    distanceKm: 11,
  },
  large: {
    midpointKg: 5.8,
    distanceKm: 16,
  },
};

const packagingProfiles: Record<
  ParcelPackagingType,
  {
    payloadDeltaKg: number;
    fragileFloor: ParcelFragileLevel;
    confidenceHint: string;
  }
> = {
  soft_pouch: {
    payloadDeltaKg: -0.1,
    fragileFloor: "low",
    confidenceHint: "Flexible packaging usually fits lighter everyday parcels.",
  },
  plastic_bag: {
    payloadDeltaKg: -0.12,
    fragileFloor: "low",
    confidenceHint:
      "Plastic bag packaging is light and best for non-fragile flexible contents.",
  },
  boxed: {
    payloadDeltaKg: 0,
    fragileFloor: "low",
    confidenceHint: "A standard box is neutral and keeps the estimate conservative.",
  },
  insulated: {
    payloadDeltaKg: 0.35,
    fragileFloor: "moderate",
    confidenceHint:
      "Insulated packaging usually implies food, pharmacy or temperature-aware contents.",
  },
  fragile_protective: {
    payloadDeltaKg: 0.45,
    fragileFloor: "high",
    confidenceHint:
      "Protective packaging is treated as a strong fragile-handling signal.",
  },
  heavy_duty: {
    payloadDeltaKg: 1.15,
    fragileFloor: "low",
    confidenceHint:
      "Heavy-duty packaging usually means denser loads or reinforced handling needs.",
  },
};

export type SemanticParcelEstimate = {
  detectedItems: string[];
  itemProfiles: readonly SemanticItemProfile[];
  estimatedWeightMinKg: number;
  estimatedWeightMaxKg: number;
  estimatedWeightKg: number;
  suggestedDimensionsCm: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  };
  fragileLevel: ParcelFragileLevel;
  category: ParcelCategory;
  confidenceNote: string;
};

export type DeterministicParcelWeightBounds = {
  minKg: number;
  maxKg: number;
  reason:
    | "declared_weight"
    | "explicit_weight"
    | "liquid_volume"
    | "semantic_profile";
  correctionNote?: string;
};

export type SemanticItemProfile = {
  id: string;
  label: string;
  keywords: readonly string[];
  category: ParcelCategory;
  materials: readonly string[];
  minKg: number;
  maxKg: number;
  dimensionsCm: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
  };
  fragileLevel: ParcelFragileLevel;
  perItemWeightKg?: {
    min: number;
    max: number;
  };
};

const semanticItemProfiles: readonly SemanticItemProfile[] = [
  {
    id: "smartphone",
    label: "telefon / smartphone",
    keywords: [
      "iphone",
      "telefon",
      "smartphone",
      "samsung galaxy",
      "google pixel",
      "xiaomi",
      "huawei",
      "oneplus",
    ],
    category: "electronics",
    materials: ["electronics", "glass", "battery"],
    minKg: 0.35,
    maxKg: 0.6,
    dimensionsCm: { lengthCm: 20, widthCm: 12, heightCm: 6 },
    fragileLevel: "moderate",
    perItemWeightKg: { min: 0.35, max: 0.6 },
  },
  {
    id: "phone_charger",
    label: "incarcator telefon",
    keywords: [
      "incarcator",
      "charger",
      "adaptor",
      "adapter",
      "cablu lightning",
      "cablu usb",
      "usb-c",
    ],
    category: "electronics",
    materials: ["electronics", "plastic", "cable"],
    minKg: 0.05,
    maxKg: 0.16,
    dimensionsCm: { lengthCm: 10, widthCm: 7, heightCm: 5 },
    fragileLevel: "low",
    perItemWeightKg: { min: 0.05, max: 0.16 },
  },
  {
    id: "tablet",
    label: "tableta",
    keywords: ["ipad", "tableta", "tablet"],
    category: "electronics",
    materials: ["electronics", "glass", "battery"],
    minKg: 0.55,
    maxKg: 1.1,
    dimensionsCm: { lengthCm: 28, widthCm: 20, heightCm: 6 },
    fragileLevel: "moderate",
    perItemWeightKg: { min: 0.55, max: 1.1 },
  },
  {
    id: "laptop",
    label: "laptop",
    keywords: ["laptop", "macbook", "notebook"],
    category: "electronics",
    materials: ["electronics", "metal", "battery"],
    minKg: 1.3,
    maxKg: 2.6,
    dimensionsCm: { lengthCm: 38, widthCm: 28, heightCm: 8 },
    fragileLevel: "moderate",
    perItemWeightKg: { min: 1.3, max: 2.6 },
  },
  {
    id: "desktop_computer",
    label: "calculator desktop / PC",
    keywords: [
      "calculator",
      "calculator desktop",
      "desktop",
      "desktop pc",
      "pc desktop",
      "unitate pc",
      "unitate calculator",
      "computer",
    ],
    category: "electronics",
    materials: ["electronics", "metal", "plastic"],
    minKg: 4,
    maxKg: 8.5,
    dimensionsCm: { lengthCm: 42, widthCm: 24, heightCm: 34 },
    fragileLevel: "moderate",
    perItemWeightKg: { min: 4, max: 8.5 },
  },
  {
    id: "computer_monitor",
    label: "monitor",
    keywords: ["monitor", "monitor pc", "monitor calculator", "display", "ecran"],
    category: "electronics",
    materials: ["electronics", "glass", "plastic"],
    minKg: 2.2,
    maxKg: 6,
    dimensionsCm: { lengthCm: 60, widthCm: 42, heightCm: 12 },
    fragileLevel: "high",
    perItemWeightKg: { min: 2.2, max: 6 },
  },
  {
    id: "computer_accessories",
    label: "accesorii calculator",
    keywords: [
      "tastatura",
      "keyboard",
      "mouse",
      "maus",
      "periferice",
      "accesorii calculator",
      "accesorii pc",
      "cablu hdmi",
      "cabluri calculator",
      "cabluri pc",
    ],
    category: "electronics",
    materials: ["electronics", "plastic", "cable"],
    minKg: 0.15,
    maxKg: 1.2,
    dimensionsCm: { lengthCm: 45, widthCm: 18, heightCm: 7 },
    fragileLevel: "low",
    perItemWeightKg: { min: 0.12, max: 0.55 },
  },
  {
    id: "computer_components",
    label: "componente PC",
    keywords: [
      "placa video",
      "gpu",
      "procesor",
      "cpu",
      "memorie ram",
      "ram",
      "ssd",
      "hard disk",
      "hdd",
      "sursa pc",
      "placa de baza",
      "motherboard",
    ],
    category: "electronics",
    materials: ["electronics", "metal", "plastic"],
    minKg: 0.15,
    maxKg: 2,
    dimensionsCm: { lengthCm: 34, widthCm: 24, heightCm: 12 },
    fragileLevel: "moderate",
    perItemWeightKg: { min: 0.1, max: 1.2 },
  },
  {
    id: "headphones",
    label: "casti",
    keywords: ["airpods", "casti", "headphones", "earbuds"],
    category: "electronics",
    materials: ["electronics", "plastic"],
    minKg: 0.08,
    maxKg: 0.45,
    dimensionsCm: { lengthCm: 18, widthCm: 14, heightCm: 8 },
    fragileLevel: "low",
    perItemWeightKg: { min: 0.08, max: 0.45 },
  },
  {
    id: "watch",
    label: "ceas",
    keywords: ["apple watch", "smartwatch", "ceas"],
    category: "electronics",
    materials: ["electronics", "glass"],
    minKg: 0.12,
    maxKg: 0.35,
    dimensionsCm: { lengthCm: 14, widthCm: 10, heightCm: 6 },
    fragileLevel: "moderate",
  },
  {
    id: "documents",
    label: "documente",
    keywords: [
      "document",
      "documents",
      "acte",
      "contract",
      "contracte",
      "dosar",
      "plic",
      "scrisoare",
      "paperwork",
      "certificate",
    ],
    category: "documents",
    materials: ["paper"],
    minKg: 0.05,
    maxKg: 0.5,
    dimensionsCm: { lengthCm: 34, widthCm: 24, heightCm: 3 },
    fragileLevel: "low",
  },
  {
    id: "book_bundle",
    label: "carti / materiale tiparite",
    keywords: ["carte", "carti", "book", "books", "manual", "manuale", "catalog"],
    category: "documents",
    materials: ["paper"],
    minKg: 0.4,
    maxKg: 2.5,
    dimensionsCm: { lengthCm: 32, widthCm: 24, heightCm: 10 },
    fragileLevel: "low",
    perItemWeightKg: { min: 0.25, max: 0.8 },
  },
  {
    id: "prepared_food",
    label: "mancare preparata",
    keywords: [
      "mancare",
      "food",
      "meal",
      "pranz",
      "cina",
      "pizza",
      "burger",
      "restaurant",
      "catering",
    ],
    category: "food",
    materials: ["food", "takeaway packaging"],
    minKg: 0.4,
    maxKg: 2.2,
    dimensionsCm: { lengthCm: 32, widthCm: 25, heightCm: 14 },
    fragileLevel: "moderate",
  },
  {
    id: "groceries",
    label: "cumparaturi alimentare",
    keywords: ["cumparaturi", "groceries", "fructe", "legume", "alimente"],
    category: "food",
    materials: ["food", "mixed packaging"],
    minKg: 1.0,
    maxKg: 5.0,
    dimensionsCm: { lengthCm: 40, widthCm: 30, heightCm: 22 },
    fragileLevel: "moderate",
  },
  {
    id: "pharmacy",
    label: "produse farmacie",
    keywords: [
      "farmacie",
      "pharmacy",
      "medicament",
      "medicamente",
      "medicine",
      "prescription",
      "reteta",
      "pastile",
    ],
    category: "medical",
    materials: ["pharmacy goods", "sealed packaging"],
    minKg: 0.1,
    maxKg: 0.8,
    dimensionsCm: { lengthCm: 22, widthCm: 16, heightCm: 10 },
    fragileLevel: "moderate",
  },
  {
    id: "medical_sample",
    label: "proba medicala / laborator",
    keywords: ["proba", "sample", "lab", "laborator", "analize", "vial", "fiola"],
    category: "medical",
    materials: ["medical sample", "protective packaging"],
    minKg: 0.1,
    maxKg: 0.6,
    dimensionsCm: { lengthCm: 20, widthCm: 14, heightCm: 10 },
    fragileLevel: "high",
  },
  {
    id: "clothing",
    label: "imbracaminte",
    keywords: [
      "haine",
      "imbracaminte",
      "clothing",
      "tricou",
      "tricouri",
      "shirt",
      "shirts",
      "pantaloni",
      "jacket",
      "geaca",
      "pantofi",
      "shoes",
    ],
    category: "retail",
    materials: ["textile"],
    minKg: 0.2,
    maxKg: 2.0,
    dimensionsCm: { lengthCm: 35, widthCm: 28, heightCm: 12 },
    fragileLevel: "low",
    perItemWeightKg: { min: 0.12, max: 0.35 },
  },
  {
    id: "cosmetics",
    label: "cosmetice",
    keywords: [
      "cosmetic",
      "cosmetice",
      "parfum",
      "perfume",
      "crema",
      "cream",
      "makeup",
      "machiaj",
      "sampon",
      "shampoo",
    ],
    category: "retail",
    materials: ["cosmetics", "plastic or glass containers"],
    minKg: 0.2,
    maxKg: 1.5,
    dimensionsCm: { lengthCm: 24, widthCm: 18, heightCm: 12 },
    fragileLevel: "moderate",
    perItemWeightKg: { min: 0.08, max: 0.45 },
  },
  {
    id: "metal_hardware",
    label: "piese metalice / suruburi",
    keywords: [
      "surub",
      "suruburi",
      "piulita",
      "piulite",
      "saiba",
      "saibe",
      "piese metalice",
      "piese din metal",
      "otel",
      "fier",
      "feronerie",
    ],
    category: "retail",
    materials: ["metal", "hardware"],
    minKg: 0.9,
    maxKg: 5.5,
    dimensionsCm: { lengthCm: 30, widthCm: 20, heightCm: 12 },
    fragileLevel: "low",
    perItemWeightKg: { min: 0.04, max: 0.18 },
  },
  {
    id: "small_tools",
    label: "unelte mici",
    keywords: [
      "unealta",
      "unelte",
      "tool",
      "tools",
      "surubelnita",
      "ciocan",
      "hardware",
      "piese",
      "parts",
    ],
    category: "retail",
    materials: ["metal", "hardware"],
    minKg: 0.5,
    maxKg: 3.5,
    dimensionsCm: { lengthCm: 34, widthCm: 22, heightCm: 12 },
    fragileLevel: "low",
    perItemWeightKg: { min: 0.15, max: 0.7 },
  },
  {
    id: "glass_ceramic",
    label: "sticla / ceramica fragila",
    keywords: [
      "sticla",
      "glass",
      "ceramic",
      "ceramica",
      "vaza",
      "vase",
      "cana",
      "cup",
      "farfurie",
      "plate",
      "borcan",
      "jar",
    ],
    category: "special",
    materials: ["glass", "ceramic"],
    minKg: 0.3,
    maxKg: 2.4,
    dimensionsCm: { lengthCm: 30, widthCm: 24, heightCm: 18 },
    fragileLevel: "high",
    perItemWeightKg: { min: 0.25, max: 1.2 },
  },
  {
    id: "plastic_goods",
    label: "obiect plastic",
    keywords: ["plastic", "obiect plastic", "recipient plastic", "jucarie plastic"],
    category: "retail",
    materials: ["plastic"],
    minKg: 0.08,
    maxKg: 0.7,
    dimensionsCm: { lengthCm: 24, widthCm: 18, heightCm: 10 },
    fragileLevel: "low",
    perItemWeightKg: { min: 0.05, max: 0.35 },
  },
];

const semanticPackagingBufferKg: Record<
  ParcelPackagingType,
  { min: number; max: number }
> = {
  soft_pouch: { min: 0.03, max: 0.08 },
  plastic_bag: { min: 0.02, max: 0.06 },
  boxed: { min: 0.06, max: 0.18 },
  insulated: { min: 0.2, max: 0.45 },
  fragile_protective: { min: 0.15, max: 0.35 },
  heavy_duty: { min: 0.35, max: 0.8 },
};

const quantityTokenPattern =
  "\\d+(?:[.,]\\d+)?|un|una|o|doi|doua|trei|patru|cinci|sase|sapte|opt|noua|zece|unsprezece|doisprezece|douasprezece|treisprezece|paisprezece|cincisprezece|saisprezece|saptesprezece|optsprezece|nouasprezece|douazeci";
const volumeExpressionPattern = new RegExp(
  `\\b(${quantityTokenPattern})\\s*(ml|mililitru|mililitri|l|litru|litri|litre|liter|liters)\\b`,
  "giu",
);
const containerNounPattern =
  "sticle|sticla|bidoane|bidon|doze|doza|cutii|cutie|pachete|pachet|recipiente|recipient|bucati|buc|cans|can|bottles|bottle|boxes|box";
const containerQuantityPattern = new RegExp(
  `\\b(?:(?:(${quantityTokenPattern})\\s*)?(?:x\\s*)?(${containerNounPattern})|(?:x\\s*(${quantityTokenPattern})\\s*(${containerNounPattern})))\\b`,
  "giu",
);
const trailingContainerQuantityPattern = new RegExp(
  `\\b(${containerNounPattern})\\s*(?:x\\s*)(${quantityTokenPattern})\\b`,
  "giu",
);
const packageQuantityPattern = new RegExp(
  `\\b(?:pachet|set|pack)\\s+(?:de\\s+)?(${quantityTokenPattern})\\b`,
  "giu",
);

const quantityWordValues: Record<string, number> = {
  un: 1,
  una: 1,
  o: 1,
  doi: 2,
  doua: 2,
  trei: 3,
  patru: 4,
  cinci: 5,
  sase: 6,
  sapte: 7,
  opt: 8,
  noua: 9,
  zece: 10,
  unsprezece: 11,
  doisprezece: 12,
  douasprezece: 12,
  treisprezece: 13,
  paisprezece: 14,
  cincisprezece: 15,
  saisprezece: 16,
  saptesprezece: 17,
  optsprezece: 18,
  nouasprezece: 19,
  douazeci: 20,
};

function formatWeight(value: number) {
  return Number(value.toFixed(1)).toString();
}

function formatWeightRange(minKg: number, maxKg: number) {
  const roundedMin = Number(minKg.toFixed(1));
  const roundedMax = Number(maxKg.toFixed(1));

  if (roundedMin === roundedMax) {
    return `${formatWeight(roundedMin)} kg`;
  }

  return `${formatWeight(roundedMin)} - ${formatWeight(roundedMax)} kg`;
}

function combineDimensions(
  profiles: readonly SemanticItemProfile[],
): SemanticParcelEstimate["suggestedDimensionsCm"] {
  if (profiles.length === 0) {
    return parcelSizeDimensions.small;
  }

  const largest = profiles.reduce((currentLargest, profile) => {
    const currentVolume =
      currentLargest.dimensionsCm.lengthCm *
      currentLargest.dimensionsCm.widthCm *
      currentLargest.dimensionsCm.heightCm;
    const nextVolume =
      profile.dimensionsCm.lengthCm *
      profile.dimensionsCm.widthCm *
      profile.dimensionsCm.heightCm;

    return nextVolume > currentVolume ? profile : currentLargest;
  }, profiles[0]);

  const extraItems = Math.max(0, profiles.length - 1);

  return {
    lengthCm: Math.min(70, largest.dimensionsCm.lengthCm + extraItems * 2),
    widthCm: Math.min(55, largest.dimensionsCm.widthCm + extraItems * 2),
    heightCm: Math.min(40, largest.dimensionsCm.heightCm + extraItems),
  };
}

function parseQuantity(value: string | undefined) {
  if (!value) {
    return 1;
  }

  const numericValue = Number(value.replace(",", "."));

  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue;
  }

  return quantityWordValues[value] ?? 1;
}

function answerToText(answer: string | number | boolean | string[]) {
  return Array.isArray(answer) ? answer.join(" ") : String(answer);
}

function getClarificationText(input: ParcelAssistantInput) {
  return (
    input.previousClarificationAnswers
      ?.map((answer) => answerToText(answer.answer))
      .join(" ") ?? ""
  );
}

function getContentsForAnalysis(input: ParcelAssistantInput) {
  return [input.contents, getClarificationText(input)]
    .filter(Boolean)
    .join(" ");
}

function getClarificationDeclaredWeightKg(input: ParcelAssistantInput) {
  const weightAnswer = input.previousClarificationAnswers?.find((answer) => {
    return answer.field === "weight" || /weight|greutate/i.test(answer.questionId);
  });

  if (!weightAnswer) {
    return null;
  }

  if (typeof weightAnswer.answer === "number" && weightAnswer.answer > 0) {
    return Number(weightAnswer.answer.toFixed(2));
  }

  return parseExplicitParcelWeightKg(answerToText(weightAnswer.answer));
}

function getClarificationItemCount(input: ParcelAssistantInput) {
  if (input.advancedDetails?.declaredItemCount && input.advancedDetails.declaredItemCount > 1) {
    return Math.min(50, Math.round(input.advancedDetails.declaredItemCount));
  }

  const quantityAnswer = input.previousClarificationAnswers?.find((answer) => {
    return (
      answer.field !== "weight" &&
      (typeof answer.answer === "number" ||
        /count|quantity|cantitate|buc|cate|câte/i.test(answer.questionId))
    );
  });

  if (!quantityAnswer) {
    return null;
  }

  const parsedQuantity =
    typeof quantityAnswer.answer === "number"
      ? quantityAnswer.answer
      : parseQuantity(answerToText(quantityAnswer.answer).trim().split(/\s+/u)[0]);

  return Number.isFinite(parsedQuantity) && parsedQuantity > 1
    ? Math.min(50, Math.round(parsedQuantity))
    : null;
}

function getClarifiedMaterialProfile(input: ParcelAssistantInput): SemanticItemProfile | null {
  const materialText = normalizeContents(getClarificationText(input));

  if (!materialText) {
    return null;
  }

  if (/\b(metal|metalic|metalice|otel|fier|steel|iron)\b/u.test(materialText)) {
    return semanticItemProfiles.find((profile) => profile.id === "metal_hardware") ?? null;
  }

  if (/\b(ceramica|ceramic|sticla|glass|vaza|vase)\b/u.test(materialText)) {
    return semanticItemProfiles.find((profile) => profile.id === "glass_ceramic") ?? null;
  }

  if (/\b(plastic)\b/u.test(materialText)) {
    return semanticItemProfiles.find((profile) => profile.id === "plastic_goods") ?? null;
  }

  if (/\b(textil|textile|haine|tricou|tricouri|clothing)\b/u.test(materialText)) {
    return semanticItemProfiles.find((profile) => profile.id === "clothing") ?? null;
  }

  return null;
}

function hasEmptyContainerSignal(contents: string) {
  return /\b(gol|goala|goale|goi|empty)\b/u.test(contents);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesProfileKeyword(normalizedContents: string, keyword: string) {
  const normalizedKeyword = normalizeContents(keyword);

  if (!normalizedKeyword) {
    return false;
  }

  if (/^[a-z0-9]{1,3}$/u.test(normalizedKeyword)) {
    return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`, "u").test(
      normalizedContents,
    );
  }

  return normalizedContents.includes(normalizedKeyword);
}

function hasAnyWord(normalizedContents: string, words: readonly string[]) {
  return words.some((word) =>
    new RegExp(`\\b${escapeRegExp(normalizeContents(word))}\\b`, "u").test(
      normalizedContents,
    ),
  );
}

function resolveSemanticProfileConflicts(
  profiles: readonly SemanticItemProfile[],
  normalizedContents: string,
) {
  const hasLaptop = profiles.some((profile) => profile.id === "laptop");
  const hasMonitor = profiles.some((profile) => profile.id === "computer_monitor");
  const hasComputerAccessories = profiles.some(
    (profile) =>
      profile.id === "computer_accessories" ||
      profile.id === "phone_charger" ||
      profile.id === "headphones",
  );
  const hasExplicitDesktopSignal = hasAnyWord(normalizedContents, [
    "desktop",
    "pc",
    "unitate",
    "tower",
  ]);

  return profiles.filter((profile) => {
    if (profile.id !== "desktop_computer") {
      return true;
    }

    if (hasExplicitDesktopSignal) {
      return true;
    }

    return !(hasLaptop || hasMonitor || hasComputerAccessories);
  });
}

function getProfileQuantity(
  normalizedContents: string,
  profile: SemanticItemProfile,
  fallbackQuantity: number | null,
) {
  if (!profile.perItemWeightKg) {
    return 1;
  }

  if (fallbackQuantity && fallbackQuantity > 1) {
    return fallbackQuantity;
  }

  for (const keyword of profile.keywords) {
    const escapedKeyword = escapeRegExp(normalizeContents(keyword));
    const beforeKeywordPattern = new RegExp(
      `\\b(${quantityTokenPattern})\\s+(?:\\w+\\s+){0,3}${escapedKeyword}\\b`,
      "iu",
    );
    const afterKeywordPattern = new RegExp(
      `\\b${escapedKeyword}\\s*(?:x\\s*)(${quantityTokenPattern})\\b`,
      "iu",
    );
    const match =
      normalizedContents.match(beforeKeywordPattern) ??
      normalizedContents.match(afterKeywordPattern);
    const quantity = parseQuantity(match?.[1]);

    if (quantity > 1) {
      return Math.min(50, Math.round(quantity));
    }
  }

  return 1;
}

function withProfileQuantity(
  profile: SemanticItemProfile,
  quantity: number,
): SemanticItemProfile {
  if (!profile.perItemWeightKg || quantity <= 1) {
    return profile;
  }

  const growth = Math.max(0, quantity - 1);

  return {
    ...profile,
    label: `${profile.label} x${quantity}`,
    minKg: Number((profile.perItemWeightKg.min * quantity).toFixed(2)),
    maxKg: Number((profile.perItemWeightKg.max * quantity).toFixed(2)),
    dimensionsCm: {
      lengthCm: Math.min(70, profile.dimensionsCm.lengthCm + growth * 1.5),
      widthCm: Math.min(55, profile.dimensionsCm.widthCm + growth * 1.2),
      heightCm: Math.min(40, profile.dimensionsCm.heightCm + growth * 0.8),
    },
  };
}

function getNearestContainerCount(prefix: string) {
  const windowText = prefix.slice(-72);
  const matches = [
    ...Array.from(windowText.matchAll(containerQuantityPattern)).map((match) => ({
      index: match.index ?? 0,
      quantity: match[1] ?? match[3],
    })),
    ...Array.from(windowText.matchAll(trailingContainerQuantityPattern)).map((match) => ({
      index: match.index ?? 0,
      quantity: match[2],
    })),
    ...Array.from(windowText.matchAll(packageQuantityPattern)).map((match) => ({
      index: match.index ?? 0,
      quantity: match[1],
    })),
  ].sort((left, right) => left.index - right.index);
  const match = matches.at(-1);

  if (!match) {
    return 1;
  }

  return parseQuantity(match.quantity);
}

function parseVolumeAmountLiters(amount: string, unit: string) {
  const parsedAmount =
    quantityWordValues[amount] ?? Number(amount.replace(",", "."));

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return null;
  }

  return unit === "ml" || unit === "mililitru" || unit === "mililitri"
    ? parsedAmount / 1000
    : parsedAmount;
}

export function parseLiquidVolumeLiters(contents: string) {
  const normalizedContents = normalizeContents(contents);

  if (hasEmptyContainerSignal(normalizedContents)) {
    return null;
  }

  const matches = Array.from(normalizedContents.matchAll(volumeExpressionPattern));

  if (matches.length === 0) {
    return null;
  }

  let totalLiters = 0;
  let totalContainers = 0;

  for (const match of matches) {
    const liters = parseVolumeAmountLiters(match[1], match[2]);

    if (liters === null) {
      continue;
    }

    const quantity = getNearestContainerCount(
      normalizedContents.slice(0, match.index),
    );

    totalLiters += liters * quantity;
    totalContainers += quantity;
  }

  if (totalLiters <= 0) {
    return null;
  }

  return {
    totalLiters,
    containerCount: Math.max(1, totalContainers),
  };
}

function getLiquidDensityKgPerLiter(contents: string) {
  if (contents.includes("lapte") || contents.includes("milk")) {
    return 1.03;
  }

  if (contents.includes("suc") || contents.includes("juice")) {
    return 1.02;
  }

  if (contents.includes("ulei") || contents.includes("oil")) {
    return 0.92;
  }

  if (
    contents.includes("alcool") ||
    contents.includes("vin") ||
    contents.includes("wine")
  ) {
    return 0.95;
  }

  return 1;
}

function getLiquidContainerWeightRange(
  contents: string,
  containerCount: number,
) {
  const mentionsGlass =
    contents.includes("sticla de sticla") ||
    contents.includes("din sticla") ||
    contents.includes("borcan") ||
    contents.includes("jar") ||
    contents.includes("glass");
  const mentionsCan =
    contents.includes("doza") ||
    contents.includes("doze") ||
    contents.includes("can") ||
    contents.includes("cans");
  const mentionsBoxOrWrap =
    contents.includes("cutie") ||
    contents.includes("carton") ||
    contents.includes("bubble") ||
    contents.includes("folie cu bule");
  const container = mentionsGlass
    ? { min: 0.25, max: 0.7 }
    : mentionsCan
      ? { min: 0.015, max: 0.04 }
      : { min: 0.05, max: 0.15 };
  const extraPackaging = mentionsBoxOrWrap
    ? { min: 0.03, max: 0.15 }
    : { min: 0, max: 0 };

  return {
    min: container.min * containerCount + extraPackaging.min,
    max: container.max * containerCount + extraPackaging.max,
  };
}

function getLiquidVolumeProfile(
  normalizedContents: string,
): SemanticItemProfile | null {
  const volume = parseLiquidVolumeLiters(normalizedContents);

  if (!volume) {
    return null;
  }

  const density = getLiquidDensityKgPerLiter(normalizedContents);
  const liquidWeightKg = volume.totalLiters * density;
  const containerWeight = getLiquidContainerWeightRange(
    normalizedContents,
    volume.containerCount,
  );
  const totalLitersLabel = Number(volume.totalLiters.toFixed(2));
  const isGlassOrFragile =
    normalizedContents.includes("vin") ||
    normalizedContents.includes("wine") ||
    normalizedContents.includes("borcan") ||
    normalizedContents.includes("glass");

  return {
    id: "liquid_volume",
    label: `lichid îmbuteliat ${totalLitersLabel} l`,
    keywords: [],
    category:
      normalizedContents.includes("medicament") ||
      normalizedContents.includes("medicine")
        ? "medical"
        : normalizedContents.includes("sampon") ||
            normalizedContents.includes("shampoo") ||
            normalizedContents.includes("cosmetic")
          ? "retail"
          : "food",
    materials: isGlassOrFragile ? ["liquid", "glass"] : ["liquid", "plastic"],
    minKg: Math.max(0.1, liquidWeightKg * 0.98 + containerWeight.min),
    maxKg: Math.max(0.2, liquidWeightKg * 1.03 + containerWeight.max),
    dimensionsCm:
      volume.totalLiters <= 0.75
        ? { lengthCm: 24, widthCm: 8, heightCm: 8 }
        : volume.totalLiters <= 2.25
          ? { lengthCm: 35, widthCm: 12, heightCm: 12 }
          : { lengthCm: 40, widthCm: 24, heightCm: 18 },
    fragileLevel: isGlassOrFragile ? "moderate" : "low",
  };
}

function getEmptyContainerProfile(
  normalizedContents: string,
): SemanticItemProfile | null {
  if (!hasEmptyContainerSignal(normalizedContents)) {
    return null;
  }

  const containerMatches = Array.from(
    normalizedContents.matchAll(containerQuantityPattern),
  );

  if (!containerMatches.length) {
    return null;
  }

  const containerCount = containerMatches.reduce(
    (total, match) => total + parseQuantity(match[1]),
    0,
  );
  const isGlass =
    normalizedContents.includes("sticla de sticla") ||
    normalizedContents.includes("din sticla") ||
    normalizedContents.includes("borcan") ||
    normalizedContents.includes("jar") ||
    normalizedContents.includes("glass");
  const weightRange = getLiquidContainerWeightRange(
    normalizedContents,
    Math.max(1, containerCount),
  );

  return {
    id: "empty_container",
    label: `recipient gol x${Math.max(1, containerCount)}`,
    keywords: [],
    category: "retail",
    materials: isGlass ? ["glass"] : ["plastic"],
    minKg: Math.max(0.03, weightRange.min),
    maxKg: Math.max(0.08, weightRange.max),
    dimensionsCm: { lengthCm: 32, widthCm: 14, heightCm: 14 },
    fragileLevel: isGlass ? "moderate" : "low",
  };
}

export function getSemanticParcelEstimate(
  input: ParcelAssistantInput,
): SemanticParcelEstimate | null {
  const analysisContents = getContentsForAnalysis(input);
  const normalizedContents = normalizeContents(analysisContents);
  const clarificationItemCount = getClarificationItemCount(input);
  const liquidVolumeProfile = getLiquidVolumeProfile(normalizedContents);
  const emptyContainerProfile = getEmptyContainerProfile(normalizedContents);
  const materialProfile = getClarifiedMaterialProfile(input);
  const rawMatchedProfiles = semanticItemProfiles.filter((profile) =>
    !((liquidVolumeProfile || emptyContainerProfile) && profile.id === "glass_ceramic") &&
    !((liquidVolumeProfile || emptyContainerProfile) && profile.id === "plastic_goods") &&
    profile.keywords.some((keyword) => matchesProfileKeyword(normalizedContents, keyword)),
  );
  const baseMatchedProfiles = resolveSemanticProfileConflicts(
    rawMatchedProfiles,
    normalizedContents,
  );
  const hasMetalHardwareProfile = baseMatchedProfiles.some(
    (profile) => profile.id === "metal_hardware",
  );
  const matchedProfiles = [
    ...baseMatchedProfiles
      .filter((profile) => !(hasMetalHardwareProfile && profile.id === "small_tools"))
      .map((profile) =>
        withProfileQuantity(
          profile,
          getProfileQuantity(normalizedContents, profile, clarificationItemCount),
        ),
      ),
    ...(materialProfile &&
    !((liquidVolumeProfile || emptyContainerProfile) && materialProfile.id === "plastic_goods") &&
    !baseMatchedProfiles.some((profile) => profile.id === materialProfile.id)
      ? [
          withProfileQuantity(
            materialProfile,
            getProfileQuantity(
              normalizedContents,
              materialProfile,
              clarificationItemCount,
            ),
          ),
        ]
      : []),
    ...(emptyContainerProfile ? [emptyContainerProfile] : []),
    ...(liquidVolumeProfile ? [liquidVolumeProfile] : []),
  ];

  if (matchedProfiles.length === 0) {
    return null;
  }

  const packagingBuffer = semanticPackagingBufferKg[input.packaging];
  const minKg =
    matchedProfiles.reduce((total, profile) => total + profile.minKg, 0) +
    packagingBuffer.min;
  const maxKg =
    matchedProfiles.reduce((total, profile) => total + profile.maxKg, 0) +
    packagingBuffer.max;
  const fragileLevel = matchedProfiles.reduce(
    (currentLevel, profile) =>
      getHigherFragilityLevel(currentLevel, profile.fragileLevel),
    packagingProfiles[input.packaging].fragileFloor,
  );
  const roundedMin = Number(Math.max(0.1, minKg).toFixed(1));
  const roundedMax = Number(Math.max(roundedMin + 0.1, maxKg).toFixed(1));
  const estimatedWeightKg = Number(((roundedMin + roundedMax) / 2).toFixed(1));
  const detectedItems = matchedProfiles.map((profile) => profile.label);
  const category = matchedProfiles[0]?.category ?? input.category ?? "retail";

  return {
    detectedItems,
    itemProfiles: matchedProfiles,
    estimatedWeightMinKg: roundedMin,
    estimatedWeightMaxKg: roundedMax,
    estimatedWeightKg,
    suggestedDimensionsCm: combineDimensions(matchedProfiles),
    fragileLevel,
    category,
    confidenceNote: "Estimare bazată pe obiectele detectate.",
  };
}

export function getDeterministicParcelWeightBounds(
  input: ParcelAssistantInput,
): DeterministicParcelWeightBounds | null {
  if (
    input.advancedDetails?.declaredWeightKg &&
    input.advancedDetails.declaredWeightKg > 0
  ) {
    const declaredWeightKg = Number(
      input.advancedDetails.declaredWeightKg.toFixed(2),
    );

    return {
      minKg: declaredWeightKg,
      maxKg: declaredWeightKg,
      reason: "declared_weight",
    };
  }

  const clarificationWeightKg = getClarificationDeclaredWeightKg(input);

  if (clarificationWeightKg !== null) {
    return {
      minKg: clarificationWeightKg,
      maxKg: clarificationWeightKg,
      reason: "explicit_weight",
      correctionNote: "Estimarea a fost ajustata dupa greutatea clarificata de utilizator.",
    };
  }

  const explicitWeightKg = parseExplicitParcelWeightKg(getContentsForAnalysis(input));

  if (explicitWeightKg !== null) {
    return {
      minKg: explicitWeightKg,
      maxKg: explicitWeightKg,
      reason: "explicit_weight",
    };
  }

  const semanticEstimate = getSemanticParcelEstimate(input);

  if (!semanticEstimate) {
    return null;
  }

  const hasLiquidVolume = parseLiquidVolumeLiters(getContentsForAnalysis(input)) !== null;

  return {
    minKg: semanticEstimate.estimatedWeightMinKg,
    maxKg: semanticEstimate.estimatedWeightMaxKg,
    reason: hasLiquidVolume ? "liquid_volume" : "semantic_profile",
    correctionNote: hasLiquidVolume
      ? "Estimarea a fost ajustată după volumul lichidului detectat."
      : undefined,
  };
}

const fragileKeywordGroups = {
  high: [
    "glass",
    "ceramic",
    "vial",
    "medical",
    "medicine",
    "sample",
    "lab",
    "device",
    "monitor",
    "screen",
    "camera",
    "lens",
  ],
  moderate: [
    "electronics",
    "electronic",
    "pharmacy",
    "food",
    "meal",
    "dessert",
    "cake",
    "pastry",
    "bottle",
    "cosmetic",
  ],
} as const;

const weightKeywordGroups = {
  heavy: [
    "tool",
    "tools",
    "metal",
    "parts",
    "hardware",
    "books",
    "documents box",
    "catering",
    "equipment",
    "printer",
    "battery",
  ],
  light: [
    "documents",
    "badge",
    "accessories",
    "samples",
    "letters",
    "paperwork",
    "prescription",
    "gift card",
  ],
} as const;

const explicitWeightPattern =
  /(?:^|[^\d])(\d+(?:[.,]\d+)?)\s*(kg|kgs|kilogram|kilograms|kilograme|kilogram(?:e)?|kilo|g|gr|gram|grams|grame)\b/iu;

function normalizeContents(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function parseExplicitParcelWeightKg(contents: string) {
  const match = normalizeContents(contents).match(explicitWeightPattern);

  if (!match) {
    return null;
  }

  const numericValue = Number(match[1].replace(",", "."));
  const unit = match[2];

  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  const valueKg =
    unit === "g" ||
    unit === "gr" ||
    unit === "gram" ||
    unit === "grams" ||
    unit === "grame"
      ? numericValue / 1000
      : numericValue;

  return Number(valueKg.toFixed(2));
}

function countKeywordMatches(contents: string, keywords: readonly string[]) {
  return keywords.reduce((count, keyword) => {
    return count + (contents.includes(keyword) ? 1 : 0);
  }, 0);
}

function getHigherFragilityLevel(
  left: ParcelFragileLevel,
  right: ParcelFragileLevel,
) {
  return fragileLevelPriority.indexOf(left) >= fragileLevelPriority.indexOf(right)
    ? left
    : right;
}

function shiftSize(size: ParcelSizeOption, delta: number) {
  const index = sizeOrder.indexOf(size);
  const nextIndex = Math.min(Math.max(index + delta, 0), sizeOrder.length - 1);

  return sizeOrder[nextIndex];
}

function inferFragileLevel(
  contents: string,
  packaging: ParcelPackagingType,
  input?: ParcelAssistantInput,
): ParcelFragileLevel {
  const semanticEstimate = getSemanticParcelEstimate({
    ...(input ?? {
      contents,
      packaging,
      approximateSize: "small",
    }),
    contents,
    packaging,
    approximateSize: "small",
  });

  if (semanticEstimate) {
    return getHigherFragilityLevel(
      packagingProfiles[packaging].fragileFloor,
      semanticEstimate.fragileLevel,
    );
  }

  const normalizedContents = normalizeContents(
    input ? getContentsForAnalysis(input) : contents,
  );
  const packagingFloor = packagingProfiles[packaging].fragileFloor;
  const highFragilityMatches = countKeywordMatches(
    normalizedContents,
    fragileKeywordGroups.high,
  );
  const moderateFragilityMatches = countKeywordMatches(
    normalizedContents,
    fragileKeywordGroups.moderate,
  );

  if (highFragilityMatches > 0) {
    return getHigherFragilityLevel(packagingFloor, "high");
  }

  if (moderateFragilityMatches > 0) {
    return getHigherFragilityLevel(packagingFloor, "moderate");
  }

  return packagingFloor;
}

function inferEstimatedPayloadKg(input: ParcelAssistantInput) {
  if (
    input.advancedDetails?.declaredWeightKg &&
    input.advancedDetails.declaredWeightKg > 0
  ) {
    return Number(input.advancedDetails.declaredWeightKg.toFixed(2));
  }

  const clarificationWeightKg = getClarificationDeclaredWeightKg(input);

  if (clarificationWeightKg !== null) {
    return clarificationWeightKg;
  }

  const explicitWeightKg = parseExplicitParcelWeightKg(getContentsForAnalysis(input));

  if (explicitWeightKg !== null) {
    return explicitWeightKg;
  }

  const semanticEstimate = getSemanticParcelEstimate(input);

  if (semanticEstimate) {
    return semanticEstimate.estimatedWeightKg;
  }

  const normalizedContents = normalizeContents(input.contents);
  const heavyKeywordMatches = countKeywordMatches(
    normalizedContents,
    weightKeywordGroups.heavy,
  );
  const lightKeywordMatches = countKeywordMatches(
    normalizedContents,
    weightKeywordGroups.light,
  );

  const basePayloadKg =
    sizeProfiles[input.approximateSize].midpointKg +
    packagingProfiles[input.packaging].payloadDeltaKg;

  const heavySignalDelta = heavyKeywordMatches * 0.55;
  const lightSignalDelta =
    lightKeywordMatches > 0 ? Math.min(lightKeywordMatches * 0.18, 0.35) : 0;

  return Math.max(0.2, Number((basePayloadKg + heavySignalDelta - lightSignalDelta).toFixed(2)));
}

function inferWeightRange(input: ParcelAssistantInput) {
  if (
    input.advancedDetails?.declaredWeightKg &&
    input.advancedDetails.declaredWeightKg > 0
  ) {
    return `${Number(input.advancedDetails.declaredWeightKg.toFixed(2))} kg`;
  }

  const clarificationWeightKg = getClarificationDeclaredWeightKg(input);

  if (clarificationWeightKg !== null) {
    return `${clarificationWeightKg} kg`;
  }

  const explicitWeightKg = parseExplicitParcelWeightKg(getContentsForAnalysis(input));

  if (explicitWeightKg !== null) {
    return `${explicitWeightKg} kg`;
  }

  const semanticEstimate = getSemanticParcelEstimate(input);

  if (semanticEstimate) {
    return formatWeightRange(
      semanticEstimate.estimatedWeightMinKg,
      semanticEstimate.estimatedWeightMaxKg,
    );
  }

  const normalizedContents = normalizeContents(getContentsForAnalysis(input));
  const heavyKeywordMatches = countKeywordMatches(
    normalizedContents,
    weightKeywordGroups.heavy,
  );
  const lightKeywordMatches = countKeywordMatches(
    normalizedContents,
    weightKeywordGroups.light,
  );

  let resolvedSize = input.approximateSize;

  if (
    input.packaging === "heavy_duty" ||
    heavyKeywordMatches >= 2
  ) {
    resolvedSize = shiftSize(resolvedSize, 1);
  } else if (
    (input.packaging === "soft_pouch" || input.packaging === "plastic_bag") &&
    lightKeywordMatches > 0 &&
    resolvedSize !== "extra_small"
  ) {
    resolvedSize = shiftSize(resolvedSize, -1);
  }

  return parcelSizeWeightRanges[resolvedSize];
}

function inferConfidenceNote(
  input: ParcelAssistantInput,
  result: Omit<ParcelAssistantResult, "confidenceNote">,
) {
  const normalizedContents = normalizeContents(input.contents);
  const fragileMatches =
    countKeywordMatches(normalizedContents, fragileKeywordGroups.high) +
    countKeywordMatches(normalizedContents, fragileKeywordGroups.moderate);
  const weightMatches =
    countKeywordMatches(normalizedContents, weightKeywordGroups.heavy) +
    countKeywordMatches(normalizedContents, weightKeywordGroups.light);
  const signalCount = fragileMatches + weightMatches;

  const packagingHint = packagingProfiles[input.packaging].confidenceHint;
  const droneLabel = droneClassLabels[result.suggestedDroneClass];
  const explicitWeightKg = parseExplicitParcelWeightKg(input.contents);
  const clarificationWeightKg = getClarificationDeclaredWeightKg(input);
  const semanticEstimate = getSemanticParcelEstimate(input);

  if (clarificationWeightKg !== null) {
    return `Estimare cu incredere ridicata: raspunsul de clarificare indica aproximativ ${clarificationWeightKg} kg, deci greutatea clarificata este folosita ca reper principal.`;
  }

  if (explicitWeightKg !== null) {
    return `Estimare cu încredere ridicată: descrierea conține explicit ${explicitWeightKg} kg, deci greutatea declarată este folosită ca reper principal.`;
  }

  if (semanticEstimate) {
    return semanticEstimate.confidenceNote;
  }

  if (normalizedContents.length < 6) {
    return `Lower confidence estimate because the contents description is very short. ${packagingHint} ${droneLabel} is the current safe default.`;
  }

  if (signalCount >= 2 || result.fragileLevel === "high") {
    return `Higher confidence estimate based on matching content signals, packaging type and approximate size. ${packagingHint} ${droneLabel} is the recommended fit.`;
  }

  return `Medium confidence estimate based on parcel size, packaging and content description. ${packagingHint} ${droneLabel} is the current suggested class.`;
}

export const parcelAssistantRuleSummary = {
  fragileEstimation:
    "Fragility is inferred from packaging first, then elevated by sensitive keywords such as medical, glass, lab, camera or electronics.",
  weightEstimation:
    "Weight starts from the selected size profile, then shifts slightly based on packaging and simple heavy or light content keywords.",
  droneRecommendation:
    "The suggested drone comes from deterministic fleet matching using the estimated payload, parcel dimensions, delivery distance and fragile handling flag.",
  confidenceModel:
    "Confidence is higher when packaging and contents tell a consistent story, and lower when the description is vague or too short.",
} as const;

export function buildBlockingProductClarifications(
  input: ParcelAssistantInput,
): ParcelClarificationQuestion[] {
  const text = normalizeContents(getContentsForAnalysis(input));
  if (!text) {
    return [];
  }

  const questions: ParcelClarificationQuestion[] = [];

  const hasModelToken = /\b\d{1,2}\b|\b(pro|plus|ultra|mini|lite|air|max|se|titum|titanium)\b|\bno\.?\s*\d+/u.test(text);

  const hasPhoneModelToken =
    /\b(s|a|m|z)\d{1,2}\b|\b(note\s*\d{1,2}|z\s*(flip|fold))\b|\bgalaxy\s+(s|a|m|z|note)\s*\d{1,2}/u.test(
      text,
    );

  if (/\b(iphone)\b/u.test(text) && !(hasModelToken || hasPhoneModelToken)) {
    questions.push({
      id: "clarify_iphone_model",
      question: "Ce model exact de iPhone trimiți?",
      field: "contents",
      answerType: "single_select",
      options: [
        { value: "iphone 15 pro max", label: "iPhone 15 Pro Max" },
        { value: "iphone 15 pro", label: "iPhone 15 Pro" },
        { value: "iphone 15", label: "iPhone 15" },
        { value: "iphone 14 pro max", label: "iPhone 14 Pro Max" },
        { value: "iphone 14 pro", label: "iPhone 14 Pro" },
        { value: "iphone 14", label: "iPhone 14" },
        { value: "iphone 13", label: "iPhone 13" },
        { value: "iphone se", label: "iPhone SE" },
      ],
      required: true,
      blocksConfirmation: true,
      reason:
        "Fiecare model are greutate și dimensiuni diferite — estimarea trebuie ajustată pe modelul exact.",
    });
  }

  if (
    /\b(samsung|galaxy|telefon|mobil)\b/u.test(text) &&
    !/\b(iphone)\b/u.test(text) &&
    !(hasModelToken || hasPhoneModelToken)
  ) {
    questions.push({
      id: "clarify_phone_model",
      question: "Ce model exact de telefon trimiți?",
      field: "contents",
      answerType: "text",
      options: [],
      required: true,
      blocksConfirmation: true,
      reason:
        "Modelul și accesoriile incluse schimbă greutatea și dimensiunile pentru drone.",
    });
  }

  if (
    /\b(laptop|notebook|ultrabook)\b/u.test(text) &&
    !/\b(macbook|asus|lenovo|dell|hp|acer|msi|razer|thinkpad|vivobook|ideapad|inspiron|xps|surface|zenbook)\b/u.test(text) &&
    !/\b\d{1,2}(\.\d)?\s*(inch|[""]|tol)\b/u.test(text)
  ) {
    questions.push({
      id: "clarify_laptop_model",
      question: "Ce model și ce diagonală are laptopul?",
      field: "contents",
      answerType: "text",
      options: [],
      required: true,
      blocksConfirmation: true,
      reason:
        "Greutatea variază de la 1 kg la peste 2.5 kg după model și diagonală.",
    });
    questions.push({
      id: "clarify_laptop_charger",
      question: "Incluzi și încărcătorul / accesoriile în colet?",
      field: "contents",
      answerType: "boolean",
      options: [
        { value: "true", label: "Da, include încărcător / accesorii" },
        { value: "false", label: "Nu, doar laptopul" },
      ],
      required: true,
      blocksConfirmation: true,
      reason: "Încărcătorul adaugă aproximativ 0.3–0.6 kg.",
    });
  }

  if (
    /\b(parfum|parfume|parfumuri|cosmetice|cosmetic|lotiune|loțiune|apa\s+de\s+toaleta|apa\s+de\s+parfum)\b/u.test(text) &&
    !/\b\d+\s*(ml|mililitri|litri|l)\b/u.test(text)
  ) {
    questions.push({
      id: "clarify_perfume_volume",
      question: "Ce volum are recipientul de parfum/cosmetice?",
      field: "dimensions",
      answerType: "single_select",
      options: [
        { value: "30ml", label: "30 ml" },
        { value: "50ml", label: "50 ml" },
        { value: "100ml", label: "100 ml" },
        { value: "125ml", label: "125 ml" },
        { value: "200ml", label: "200 ml" },
      ],
      required: true,
      blocksConfirmation: true,
      reason:
        "Volumul recipientului determină greutatea lichidului + recipient de sticlă.",
    });
    questions.push({
      id: "clarify_perfume_container",
      question: "Cum este recipientul?",
      field: "packaging",
      answerType: "single_select",
      options: [
        { value: "spray", label: "Sticlă cu spray/pompă" },
        { value: "dop", label: "Sticlă cu dop" },
        { value: "tub", label: "Tub/roll-on" },
      ],
      required: false,
      blocksConfirmation: true,
      reason: "Tipul recipientului influențează greutatea finală a sticlei.",
    });
  }

  if (
    /\b(medicament|medicamente|medicinal|reteta|rețeta|farmaceutic|farmacia|pharmacy)\b/u.test(text) &&
    !/\b(ambient|frigider|refrigerat|congelator|temperatura|cold\s*chain|insulated)\b/u.test(text)
  ) {
    questions.push({
      id: "clarify_meds_temperature",
      question: "Medicamentele necesită temperatură controlată?",
      field: "weather_sensitivity",
      answerType: "single_select",
      options: [
        { value: "ambient", label: "Temperatură ambientă" },
        { value: "fridge", label: "Frigider (2–8°C)" },
        { value: "frozen", label: "Congelator" },
        { value: "unknown", label: "Nu sunt sigur" },
      ],
      required: true,
      blocksConfirmation: true,
      reason:
        "Unele medicamente necesită ambalaj izolat sau manipulare specială.",
    });
  }

  const hasLiquidVolume = parseLiquidVolumeLiters(text) !== null;
  const hasFragileObject =
    /\b(vaza|oglinda|ceramica|ceramic|sticla|sticlă|porțelan|portelan|cristal|crystal|pahare|pahar)\b/u.test(text);
  if (hasFragileObject && !hasLiquidVolume) {
    if (!/\b(sticla|ceramica|ceramic|porțelan|portelan|cristal|crystal|geam|glass)\b/u.test(text)) {
      questions.push({
        id: "clarify_fragile_material",
        question: "Din ce material este obiectul fragil?",
        field: "fragility",
        answerType: "single_select",
        options: [
          { value: "glass", label: "Sticlă" },
          { value: "ceramic", label: "Ceramică" },
          { value: "porcelain", label: "Porțelan" },
          { value: "crystal", label: "Cristal" },
        ],
        required: true,
        blocksConfirmation: true,
        reason: "Materialul modifică densitatea și nivelul fragil.",
      });
    }
    if (!/\b(spuma|bubble|bule|spumă|cutie\s+rigida|ambalaj\s+original|protectie|protecție)\b/u.test(text)) {
      questions.push({
        id: "clarify_fragile_packaging",
        question: "Cum este ambalat obiectul fragil?",
        field: "packaging",
        answerType: "single_select",
        options: [
          { value: "original_box", label: "Cutie originală / ambalaj producător" },
          { value: "bubble_wrap", label: "Bule + cutie rigidă" },
          { value: "foam", label: "Spumă protectoare" },
          { value: "minimal", label: "Ambalaj minim" },
        ],
        required: true,
        blocksConfirmation: true,
        reason: "Ambalajul fragil influențează greutatea și manipularea.",
      });
    }
  }

  return questions.slice(0, 3);
}

export function getLocalParcelAssistantResult(
  input: ParcelAssistantInput,
): ParcelAssistantResult {
  const semanticEstimate = getSemanticParcelEstimate(input);
  const fragileLevel = input.fragilityLevel
    ? getHigherFragilityLevel(
        inferFragileLevel(input.contents, input.packaging, input),
        input.fragilityLevel,
      )
    : inferFragileLevel(input.contents, input.packaging, input);
  const estimatedPayloadKg = inferEstimatedPayloadKg(input);
  const recommendedDrone =
    getRecommendedDrone({
      payloadKg: estimatedPayloadKg,
      parcelDimensionsCm:
        semanticEstimate?.suggestedDimensionsCm ??
        parcelSizeDimensions[input.approximateSize],
      deliveryDistanceKm: semanticEstimate
        ? sizeProfiles.small.distanceKm
        : sizeProfiles[input.approximateSize].distanceKm,
      urgency:
        fragileLevel === "high"
          ? "priority"
          : semanticEstimate || input.approximateSize === "extra_small"
            ? "critical"
            : "standard",
      requiresFragileHandling: fragileLevel === "high",
    }) ?? null;

  const suggestedDroneClass = recommendedDrone?.id ?? "standard_courier";

  const result: Omit<ParcelAssistantResult, "confidenceNote"> = {
    estimatedWeightRange: inferWeightRange(input),
    estimatedWeightKg: estimatedPayloadKg,
    suggestedDimensionsCm:
      input.advancedDetails?.declaredDimensionsCm ??
      semanticEstimate?.suggestedDimensionsCm ??
      parcelSizeDimensions[input.approximateSize],
    fragileLevel,
    suggestedDroneClass,
  };

  return {
    ...result,
    confidenceNote: inferConfidenceNote(input, result),
  };
}

export { parcelFragileLevelLabels };
