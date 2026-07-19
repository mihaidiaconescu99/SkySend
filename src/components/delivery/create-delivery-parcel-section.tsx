"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ImagePlus,
  Camera,
  LoaderCircle,
  MessageSquareText,
  Send,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  getFleetMaxPayloadKg,
  isCreateDeliveryParcelConfirmed,
  parcelCategoryLabels,
  parcelCategoryOptions,
  parcelFragileLevelLabels,
  parcelPackagingLabels,
  parcelPackagingOptions,
  toParcelAssistantInput,
} from "@/lib/create-delivery-parcel";
import type { CreateDeliveryParcelDraft } from "@/lib/create-delivery-parcel";
import { getLocalParcelAssistantResult } from "@/lib/parcel-assistant";
import { uploadMessageFiles } from "@/lib/attachments/client";
import {
  operatorParcelEvaluationStatusLabels,
  operatorParcelWarningLabels,
} from "@/lib/parcel-evaluations/constants";
import {
  cancelParcelEvaluationRequest,
  fetchParcelEvaluation,
  requestParcelEvaluation,
  sendParcelEvaluationAnswer,
} from "@/lib/parcel-evaluations/client";
import { cn } from "@/lib/utils";
import type {
  ParcelAssistantInput,
  ParcelAssistantResult,
} from "@/types/parcel-assistant";
import type {
  ParcelClarificationAnswer,
  ParcelClarificationQuestion,
} from "@/types/parcel-intelligence";
import type {
  ParcelEstimatorErrorResponse,
  ParcelEstimatorResponse,
} from "@/types/parcel-estimator";
import type { OperatorParcelEvaluation } from "@/types/operator-parcel-evaluation";
import type { ParcelEstimateTraceSnapshot } from "@/types/operator-parcel-evaluation";

type CreateDeliveryParcelSectionProps = {
  sessionId: string;
  parcel: CreateDeliveryParcelDraft;
  guidance: ParcelAssistantResult;
  onChange: <K extends keyof CreateDeliveryParcelDraft>(
    field: K,
    value: CreateDeliveryParcelDraft[K],
  ) => void;
  onAssistantUpdate: (
    input: ParcelAssistantInput,
    result: ParcelAssistantResult,
  ) => void;
};

type AdvancedDetailsDraft = {
  knownWeightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  packaging: CreateDeliveryParcelDraft["packaging"];
  fragile: boolean;
  notes: string;
};

type ClarificationAnswerDraft = Record<string, string>;

type ParcelAiImageDraft = {
  id: string;
  slot: number;
  name: string;
  previewUrl: string;
  status: string;
  expiresAt?: string;
};

type ConfirmationDraft = {
  weightMinKg: string;
  weightMaxKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  packaging: CreateDeliveryParcelDraft["packaging"];
  category: CreateDeliveryParcelDraft["category"];
  fragilityLevel: CreateDeliveryParcelDraft["fragilityLevel"];
};

function readParcelEstimateWeightLabel(estimate: ParcelEstimatorResponse | null) {
  if (!estimate) {
    return null;
  }

  if (estimate.estimatedWeightMin === estimate.estimatedWeightMax) {
    return `${estimate.estimatedWeightMin} kg`;
  }

  return `${estimate.estimatedWeightMin} - ${estimate.estimatedWeightMax} kg`;
}

function buildAssistantResult(
  input: ParcelAssistantInput,
  estimate: ParcelEstimatorResponse | null,
): ParcelAssistantResult {
  const localResult = getLocalParcelAssistantResult(input);

  if (!estimate) {
    return {
      ...localResult,
      confidenceNote:
        "Estimare locală bazată pe conținut, ambalaj, mărime și fragilitate.",
    };
  }

  return {
    estimatedWeightRange:
      estimate.estimatedWeightRange?.label ??
      readParcelEstimateWeightLabel(estimate) ??
      localResult.estimatedWeightRange,
    estimatedWeightKg: Number(
      ((estimate.estimatedWeightMin + estimate.estimatedWeightMax) / 2).toFixed(1),
    ),
    suggestedDimensionsCm:
      estimate.suggestedDimensionsCm ?? localResult.suggestedDimensionsCm,
    fragileLevel: estimate.fragileLevel,
    suggestedDroneClass: estimate.recommendedDroneClass,
    confidenceNote: estimate.explanation,
    clarificationQuestions: estimate.clarificationQuestions,
    intelligence: estimate.intelligence,
    confirmedProfile: estimate.confirmedProfile,
  };
}

function parseOptionalNumber(value: string) {
  const parsedValue = Number(value);

  return value.trim() !== "" && Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : null;
}

function getConfidenceLabel(estimate: ParcelEstimatorResponse | null) {
  if (!estimate) {
    return "În așteptare";
  }

  if (estimate.confidence === "high") {
    return "Încredere ridicată";
  }

  if (estimate.confidence === "medium") {
    return "Încredere medie";
  }

  return "Încredere scăzută";
}

function formatEstimateNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("ro-RO", {
    maximumFractionDigits,
  }).format(value);
}

function getLiquidDensityLabel(contents: string) {
  const normalizedContents = contents
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (normalizedContents.includes("lapte") || normalizedContents.includes("milk")) {
    return { label: "lapte", densityKgPerLiter: 1.03 };
  }

  if (normalizedContents.includes("suc") || normalizedContents.includes("juice")) {
    return { label: "suc", densityKgPerLiter: 1.02 };
  }

  if (normalizedContents.includes("ulei") || normalizedContents.includes("oil")) {
    return { label: "ulei", densityKgPerLiter: 0.92 };
  }

  if (normalizedContents.includes("vin") || normalizedContents.includes("wine")) {
    return { label: "vin", densityKgPerLiter: 0.95 };
  }

  return { label: "apă", densityKgPerLiter: 1 };
}

function getCorrectionDisplay(
  estimate: ParcelEstimatorResponse | null,
  contents: string,
) {
  const correction = estimate?.corrections?.[0];

  if (!estimate || !correction) {
    return null;
  }

  const detectedVolumeLiters =
    correction.detectedVolumeLiters ?? estimate.volumeLiters ?? null;
  const correctedWeightLabel =
    correction.correctedWeightRange?.label ??
    estimate.estimatedWeightRange?.label ??
    readParcelEstimateWeightLabel(estimate);
  const liquid = getLiquidDensityLabel(contents);
  const message =
    correction.code === "liquid_volume" && detectedVolumeLiters
      ? `Am ajustat greutatea după volumul detectat: ${formatEstimateNumber(
          detectedVolumeLiters,
          2,
        )} L ${liquid.label} ≈ ${formatEstimateNumber(
          detectedVolumeLiters * liquid.densityKgPerLiter,
          1,
        )} kg + ambalaj.`
      : correction.message;

  return {
    message,
    correctedWeightLabel,
    detectedVolumeLabel: detectedVolumeLiters
      ? `${formatEstimateNumber(detectedVolumeLiters, 2)} L`
      : (correction.detectedVolumeLabel ?? null),
  };
}

function buildAdvancedDetails(advancedDetails: AdvancedDetailsDraft) {
  const declaredWeightKg = parseOptionalNumber(advancedDetails.knownWeightKg);
  const lengthCm = parseOptionalNumber(advancedDetails.lengthCm);
  const widthCm = parseOptionalNumber(advancedDetails.widthCm);
  const heightCm = parseOptionalNumber(advancedDetails.heightCm);
  const hasDeclaredDimensions = Boolean(lengthCm && widthCm && heightCm);

  return {
    packagingType: advancedDetails.packaging,
    declaredWeightKg,
    declaredDimensionsCm: hasDeclaredDimensions
      ? {
          lengthCm: lengthCm as number,
          widthCm: widthCm as number,
          heightCm: heightCm as number,
        }
      : null,
    notes: advancedDetails.notes.trim() || null,
  };
}

function buildConfirmationDraft(
  estimate: ParcelEstimatorResponse,
  parcel: CreateDeliveryParcelDraft,
  advancedDetails: AdvancedDetailsDraft,
): ConfirmationDraft {
  const dimensions =
    estimate.suggestedDimensionsCm ??
    estimate.estimatedDimensions?.dimensionsCm ??
    null;

  return {
    weightMinKg: String(estimate.estimatedWeightMin),
    weightMaxKg: String(estimate.estimatedWeightMax),
    lengthCm: dimensions?.lengthCm ? String(dimensions.lengthCm) : "",
    widthCm: dimensions?.widthCm ? String(dimensions.widthCm) : "",
    heightCm: dimensions?.heightCm ? String(dimensions.heightCm) : "",
    packaging:
      estimate.packagingInference?.packagingType ?? advancedDetails.packaging,
    category: estimate.category ?? parcel.category,
    fragilityLevel: estimate.fragileLevel,
  };
}

function buildEstimateTraceSnapshot(
  estimate: ParcelEstimatorResponse,
): ParcelEstimateTraceSnapshot | null {
  const trace = estimate.lookupTrace;
  if (!trace) {
    return null;
  }

  const detectedItemsEvidence = (estimate.detectedItemsDetailed ?? [])
    .filter(
      (item) =>
        (item.sourceUrls && item.sourceUrls.length > 0) ||
        (item.lookupEvidence && item.lookupEvidence.length > 0),
    )
    .map((item) => ({
      label: item.label,
      sourceUrls: item.sourceUrls ?? [],
      lookupEvidence: item.lookupEvidence ?? [],
      evidenceConfidence: item.evidenceConfidence ?? null,
    }));

  return {
    lookupTrace: trace,
    detectedItemsEvidence,
    confidenceScore: estimate.confidenceScore ?? null,
    confidence: estimate.confidence,
    source: estimate.source,
  };
}

function formatWeightRangeFromDraft(draft: ConfirmationDraft) {
  const minKg = parseOptionalNumber(draft.weightMinKg);
  const maxKg = parseOptionalNumber(draft.weightMaxKg) ?? minKg;

  if (!minKg || !maxKg) {
    return "";
  }

  return minKg === maxKg ? `${minKg} kg` : `${minKg} - ${maxKg} kg`;
}

function buildEstimateFromDraft(
  estimate: ParcelEstimatorResponse,
  draft: ConfirmationDraft,
): ParcelEstimatorResponse {
  const minKg = parseOptionalNumber(draft.weightMinKg) ?? estimate.estimatedWeightMin;
  const maxKg = parseOptionalNumber(draft.weightMaxKg) ?? minKg;
  const lengthCm = parseOptionalNumber(draft.lengthCm);
  const widthCm = parseOptionalNumber(draft.widthCm);
  const heightCm = parseOptionalNumber(draft.heightCm);
  const dimensions =
    lengthCm && widthCm && heightCm
      ? {
          lengthCm,
          widthCm,
          heightCm,
        }
      : estimate.suggestedDimensionsCm;
  const volumeLiters = dimensions
    ? Number(((dimensions.lengthCm * dimensions.widthCm * dimensions.heightCm) / 1000).toFixed(1))
    : (estimate.volumeLiters ?? null);
  const normalizedMinKg = Number(Math.min(minKg, maxKg).toFixed(1));
  const normalizedMaxKg = Number(Math.max(minKg, maxKg).toFixed(1));
  const weightLabel =
    normalizedMinKg === normalizedMaxKg
      ? `${normalizedMinKg} kg`
      : `${normalizedMinKg} - ${normalizedMaxKg} kg`;

  return {
    ...estimate,
    estimatedWeightMin: normalizedMinKg,
    estimatedWeightMax: normalizedMaxKg,
    estimatedWeightRange: {
      ...(estimate.estimatedWeightRange ?? {}),
      minKg: normalizedMinKg,
      maxKg: normalizedMaxKg,
      midpointKg: Number(((normalizedMinKg + normalizedMaxKg) / 2).toFixed(1)),
      label: weightLabel,
    },
    suggestedDimensionsCm: dimensions,
    estimatedDimensions: dimensions
      ? {
          ...(estimate.estimatedDimensions ?? {}),
          dimensionsCm: dimensions,
          volumeLiters: volumeLiters ?? 0,
        }
      : estimate.estimatedDimensions,
    volumeLiters,
    category: draft.category,
    fragileLevel: draft.fragilityLevel,
    packagingInference: {
      packagingType: draft.packaging,
      assumption:
        estimate.packagingInference?.assumption ??
        estimate.packagingAssumption ??
        "Ambalaj confirmat manual.",
      confidenceScore: estimate.packagingInference?.confidenceScore ?? 80,
      confidence: estimate.packagingInference?.confidence ?? "medium",
      alternatives: estimate.packagingInference?.alternatives,
    },
  };
}

function getWeatherNotes(estimate: ParcelEstimatorResponse) {
  const weather = estimate.weatherSensitivity;

  if (!weather) {
    return [];
  }

  return [
    weather.rain ? "Sensibil la ploaie" : null,
    weather.wind ? "Atenție la vânt" : null,
    weather.heat ? "Sensibil la căldură" : null,
    weather.cold ? "Sensibil la frig" : null,
    weather.humidity ? "Sensibil la umiditate" : null,
    weather.notes ?? null,
  ].filter((note): note is string => Boolean(note));
}

function getClarificationQuestions(
  estimate: ParcelEstimatorResponse | null,
): ParcelClarificationQuestion[] {
  if (!estimate || estimate.confidence === "high") {
    return [];
  }

  if (estimate.clarificationQuestions?.length) {
    return estimate.clarificationQuestions.slice(0, 3);
  }

  if (estimate.confidence === "low") {
    return [
      {
        id: "low-confidence-contents",
        question:
          "Ce conține exact coletul și câte obiecte sunt în pachet?",
        field: "contents",
        answerType: "text",
        required: true,
        blocksConfirmation: true,
        reason:
          "Profilul are încredere scăzută și nu poate recomanda automat configurația fără clarificări.",
      },
      {
        id: "low-confidence-weight",
        question: "Care este greutatea aproximativă a coletului în kg?",
        field: "weight",
        answerType: "number",
        required: true,
        blocksConfirmation: true,
        reason:
          "Greutatea confirmată este necesară pentru eligibilitatea modulului cargo.",
      },
    ];
  }

  return [];
}

function getQuestionOptions(question: ParcelClarificationQuestion) {
  const options = question.options?.length ? question.options :
    question.field === "packaging" ? [
      { value: "boxed", label: "Cutie" },
      { value: "soft_pouch", label: "Plic" },
      { value: "plastic_bag", label: "Pungă de plastic" },
      { value: "original", label: "Ambalaj original" },
    ] : question.field === "fragility" ? [
      { value: "yes", label: "Da" },
      { value: "no", label: "Nu" },
    ] : question.answerType === "boolean" ? [
      { value: "true", label: "Da" },
      { value: "false", label: "Nu" },
    ] : [];

  if (!options.length || question.answerType === "boolean") {
    return options;
  }
  return options.some((option) => option.value === "__custom")
    ? options
    : [...options, { value: "__custom", label: "Alt răspuns" }];
}

function normalizeClarificationAnswer(
  question: ParcelClarificationQuestion,
  rawAnswer: string,
): ParcelClarificationAnswer | null {
  const answer = rawAnswer.trim();

  if (!answer) {
    return null;
  }

  if (question.answerType === "number") {
    const numericAnswer = Number(answer.replace(",", "."));

    if (!Number.isFinite(numericAnswer)) {
      return null;
    }

    return {
      questionId: question.id,
      field: question.field,
      answer: numericAnswer,
    };
  }

  if (question.answerType === "boolean") {
    return {
      questionId: question.id,
      field: question.field,
      answer: answer === "true" || answer === "yes",
    };
  }

  if (question.answerType === "multi_select") {
    return {
      questionId: question.id,
      field: question.field,
      answer: answer.split("|").filter(Boolean),
    };
  }

  return {
    questionId: question.id,
    field: question.field,
    answer,
  };
}

function formatClarificationAnswers(
  answers: ParcelClarificationAnswer[],
  questions: ParcelClarificationQuestion[],
) {
  if (!answers.length) {
    return "";
  }

  return answers
    .map((answer) => {
      const question = questions.find((item) => item.id === answer.questionId);
      const prompt = question?.question ?? answer.field ?? "Clarificare";

      return `${prompt}: ${Array.isArray(answer.answer) ? answer.answer.join(", ") : answer.answer}`;
    })
    .join("\n");
}

function mergeClarificationAnswers(
  currentAnswers: ParcelClarificationAnswer[],
  nextAnswers: ParcelClarificationAnswer[],
) {
  const mergedAnswers = new Map<string, ParcelClarificationAnswer>();

  [...currentAnswers, ...nextAnswers].forEach((answer) => {
    mergedAnswers.set(answer.questionId, answer);
  });

  return Array.from(mergedAnswers.values());
}

function buildOperatorAssistantInput(
  evaluation: OperatorParcelEvaluation,
): ParcelAssistantInput | null {
  if (!evaluation.profile) {
    return null;
  }

  const isFragile = evaluation.profile.warnings.includes("fragile");

  return {
    contents: evaluation.initialDescription,
    naturalDescription: {
      text: evaluation.initialDescription,
      locale: "ro-RO",
      source: "customer",
      capturedAt: evaluation.createdAt,
    },
    advancedDetails: {
      packagingType: evaluation.parcelSnapshot.packaging,
      declaredWeightKg: evaluation.profile.weightKg,
      declaredDimensionsCm: {
        lengthCm: evaluation.profile.lengthCm,
        widthCm: evaluation.profile.widthCm,
        heightCm: evaluation.profile.heightCm,
      },
      notes: evaluation.profile.warnings
        .map((warning) => operatorParcelWarningLabels[warning])
        .join(", "),
    },
    category: evaluation.parcelSnapshot.category,
    packaging: evaluation.parcelSnapshot.packaging,
    approximateSize: evaluation.parcelSnapshot.approximateSize,
    fragilityLevel: isFragile ? "high" : evaluation.parcelSnapshot.fragilityLevel,
  };
}

function buildOperatorAssistantResult(
  evaluation: OperatorParcelEvaluation,
  fallbackDroneClass: ParcelAssistantResult["suggestedDroneClass"],
): ParcelAssistantResult | null {
  if (!evaluation.profile) {
    return null;
  }

  const isFragile = evaluation.profile.warnings.includes("fragile");
  const warningLabels = evaluation.profile.warnings.map(
    (warning) => operatorParcelWarningLabels[warning],
  );

  return {
    estimatedWeightRange: `${evaluation.profile.weightKg.toFixed(1)} kg`,
    estimatedWeightKg: evaluation.profile.weightKg,
    suggestedDimensionsCm: {
      lengthCm: evaluation.profile.lengthCm,
      widthCm: evaluation.profile.widthCm,
      heightCm: evaluation.profile.heightCm,
    },
    fragileLevel: isFragile ? "high" : evaluation.parcelSnapshot.fragilityLevel,
    suggestedDroneClass: fallbackDroneClass,
    confidenceNote: warningLabels.length
      ? `Profil aplicat de operator. Atentionari: ${warningLabels.join(", ")}.`
      : "Profil aplicat de operator.",
  };
}

export const CreateDeliveryParcelSection = memo(function CreateDeliveryParcelSection({
  sessionId,
  parcel,
  guidance,
  onAssistantUpdate,
}: CreateDeliveryParcelSectionProps) {
  const [naturalDescription, setNaturalDescription] = useState(
    parcel.contentDescription,
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedDetails, setAdvancedDetails] = useState<AdvancedDetailsDraft>({
    knownWeightKg: parcel.weightKg ? String(parcel.weightKg) : "",
    lengthCm: parcel.lengthCm ? String(parcel.lengthCm) : "",
    widthCm: parcel.widthCm ? String(parcel.widthCm) : "",
    heightCm: parcel.heightCm ? String(parcel.heightCm) : "",
    packaging: parcel.packaging,
    fragile: parcel.fragilityLevel === "high",
    notes: "",
  });
  const [pendingEstimate, setPendingEstimate] =
    useState<ParcelEstimatorResponse | null>(null);
  const [pendingInput, setPendingInput] = useState<ParcelAssistantInput | null>(
    null,
  );
  const [confirmationDraft, setConfirmationDraft] =
    useState<ConfirmationDraft | null>(null);
  const [isEditingConfirmation, setIsEditingConfirmation] = useState(false);
  const [clarificationAnswers, setClarificationAnswers] =
    useState<ClarificationAnswerDraft>({});
  const [submittedClarificationAnswers, setSubmittedClarificationAnswers] =
    useState<ParcelClarificationAnswer[]>([]);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [operatorEvaluation, setOperatorEvaluation] =
    useState<OperatorParcelEvaluation | null>(null);
  const [operatorAnswerDraft, setOperatorAnswerDraft] = useState("");
  const [operatorAnswerFiles, setOperatorAnswerFiles] = useState<File[]>([]);
  const [parcelAiImages, setParcelAiImages] = useState<ParcelAiImageDraft[]>([]);
  const [parcelAiImageError, setParcelAiImageError] = useState<string | null>(null);
  const [isUploadingParcelImage, setIsUploadingParcelImage] = useState(false);
  const [canUseCamera, setCanUseCamera] = useState(false);
  const parcelImagePickerRef = useRef<HTMLInputElement>(null);
  const parcelCameraPickerRef = useRef<HTMLInputElement>(null);
  const [evaluationViewId] = useState(() => crypto.randomUUID());
  const [operatorRequestError, setOperatorRequestError] = useState<string | null>(
    null,
  );
  const [appliedOperatorEvaluationId, setAppliedOperatorEvaluationId] = useState<
    string | null
  >(null);

  const hasNaturalDescription = naturalDescription.trim().length >= 3;
  const hasConfirmedParcel = isCreateDeliveryParcelConfirmed(parcel);
  const maxPayloadKg = getFleetMaxPayloadKg();
  const editedPendingEstimate =
    pendingEstimate && confirmationDraft
      ? buildEstimateFromDraft(pendingEstimate, confirmationDraft)
      : pendingEstimate;
  const activeEstimateResult = editedPendingEstimate
    ? buildAssistantResult(
        pendingInput ?? toParcelAssistantInput(parcel),
        editedPendingEstimate,
      )
    : null;
  const correctionDisplay = getCorrectionDisplay(
    editedPendingEstimate,
    pendingInput?.contents ?? naturalDescription,
  );
  const detectedItems = pendingEstimate?.detectedItems ?? [];
  const handlingNotes = pendingEstimate?.handlingNotes ?? [];
  const weatherNotes = pendingEstimate ? getWeatherNotes(pendingEstimate) : [];
  const riskFlags = pendingEstimate?.riskFlags ?? [];
  const clarificationQuestions = getClarificationQuestions(pendingEstimate);
  const hasClarificationQuestions = clarificationQuestions.length > 0;
  const hasBlockingClarificationQuestions = clarificationQuestions.some(
    (question) => question.blocksConfirmation === true,
  );
  const normalizedClarificationAnswers = clarificationQuestions
    .map((question) => {
      const raw = clarificationAnswers[question.id] ?? "";
      const custom = clarificationAnswers[`${question.id}__custom`] ?? "";
      const answer = question.answerType === "multi_select"
        ? raw.split("|").flatMap((item) => item === "__custom" ? (custom ? [custom] : []) : [item]).join("|")
        : raw === "__custom" ? custom : raw;
      return normalizeClarificationAnswer(question, answer);
    })
    .filter((answer): answer is ParcelClarificationAnswer => Boolean(answer));
  const canRefineWithAnswers =
    hasClarificationQuestions &&
    normalizedClarificationAnswers.length === clarificationQuestions.length;
  const hasManualAdvancedDetails = Boolean(
    advancedDetails.knownWeightKg.trim() ||
      advancedDetails.lengthCm.trim() ||
      advancedDetails.widthCm.trim() ||
      advancedDetails.heightCm.trim() ||
      advancedDetails.notes.trim() ||
      advancedDetails.packaging !== parcel.packaging ||
      advancedDetails.fragile !== (parcel.fragilityLevel === "high"),
  );
  const manualWeightKg = parseOptionalNumber(advancedDetails.knownWeightKg);
  const manualLengthCm = parseOptionalNumber(advancedDetails.lengthCm);
  const manualWidthCm = parseOptionalNumber(advancedDetails.widthCm);
  const manualHeightCm = parseOptionalNumber(advancedDetails.heightCm);
  const canConfirmManualDetails = Boolean(
    manualWeightKg && manualLengthCm && manualWidthCm && manualHeightCm,
  );
  const canConfirmEstimate =
    Boolean(editedPendingEstimate && pendingInput) &&
    !hasBlockingClarificationQuestions;
  const pendingWeightMaxKg = confirmationDraft
    ? parseOptionalNumber(confirmationDraft.weightMaxKg)
    : (editedPendingEstimate?.estimatedWeightMax ?? null);
  const pendingOverweight =
    Boolean(pendingWeightMaxKg) &&
    Number(pendingWeightMaxKg) > maxPayloadKg;
  const activeOperatorQuestion = operatorEvaluation?.questions.find(
    (question) => !question.answer,
  );
  const isOperatorEvaluationClosed =
    operatorEvaluation?.status === "finalized" ||
    operatorEvaluation?.status === "closed";
  const operatorEvaluationLocksParcel = Boolean(
    operatorEvaluation && operatorEvaluation.status !== "closed",
  );

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    async function refreshOperatorEvaluation() {
      try {
        const evaluation = await fetchParcelEvaluation(sessionId, evaluationViewId);
        if (active) setOperatorEvaluation(evaluation);
      } catch {
        if (active) setOperatorRequestError("Evaluarea nu poate fi încărcată momentan.");
      }
    }
    void refreshOperatorEvaluation();
    const timer = window.setInterval(() => void refreshOperatorEvaluation(), 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [evaluationViewId, sessionId]);

  useEffect(() => {
    setCanUseCamera(Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    void fetch(`/api/parcel-ai/images?draftId=${encodeURIComponent(sessionId)}`, { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() : { images: [] })
      .then((payload) => {
        if (!active) return;
        setParcelAiImages((payload.images ?? []).map((image: ParcelAiImageDraft) => ({ ...image, previewUrl: image.previewUrl })));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [sessionId]);

  useEffect(() => {
    if (
      !operatorEvaluation ||
      operatorEvaluation.status !== "finalized" ||
      !operatorEvaluation.profile ||
      appliedOperatorEvaluationId === operatorEvaluation.id
    ) {
      return;
    }

    const operatorInput = buildOperatorAssistantInput(operatorEvaluation);
    const operatorResult = buildOperatorAssistantResult(
      operatorEvaluation,
      guidance.suggestedDroneClass,
    );

    if (!operatorInput || !operatorResult) {
      return;
    }

    onAssistantUpdate(operatorInput, operatorResult);
    setAppliedOperatorEvaluationId(operatorEvaluation.id);
    setPendingEstimate(null);
    setPendingInput(null);
    setConfirmationDraft(null);
    setIsEditingConfirmation(false);
    setClarificationAnswers({});
    setSubmittedClarificationAnswers([]);
  }, [
    appliedOperatorEvaluationId,
    guidance.suggestedDroneClass,
    onAssistantUpdate,
    operatorEvaluation,
  ]);

  function updateAdvancedDetails<K extends keyof AdvancedDetailsDraft>(
    field: K,
    value: AdvancedDetailsDraft[K],
  ) {
    if (operatorEvaluationLocksParcel) return;
    setAdvancedDetails((currentValue) => ({
      ...currentValue,
      [field]: value,
    }));
    setPendingEstimate(null);
    setPendingInput(null);
    setConfirmationDraft(null);
    setIsEditingConfirmation(false);
    setClarificationAnswers({});
    setSubmittedClarificationAnswers([]);
    setEstimateError(null);
  }

  async function uploadParcelAiImage(file: File, slot: number) {
    const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!acceptedTypes.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setParcelAiImageError("Alege o imagine JPEG, PNG, WebP sau HEIC/HEIF de maximum 10 MB.");
      return;
    }
    setIsUploadingParcelImage(true);
    setParcelAiImageError(null);
    const localPreviewUrl = URL.createObjectURL(file);
    try {
      const response = await fetch("/api/parcel-ai/images", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: sessionId, slot, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      const upload = await response.json();
      if (!response.ok) throw new Error(upload.error ?? "upload_unavailable");
      const put = await fetch(upload.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("r2_upload_failed");
      setParcelAiImages((current) => {
        current.filter((image) => image.slot === slot && image.previewUrl.startsWith("blob:")).forEach((image) => URL.revokeObjectURL(image.previewUrl));
        return [...current.filter((image) => image.slot !== slot), { id: upload.id, slot, name: file.name, previewUrl: localPreviewUrl, status: "uploaded", expiresAt: upload.expiresAt }].sort((a, b) => a.slot - b.slot);
      });
    } catch {
      URL.revokeObjectURL(localPreviewUrl);
      setParcelAiImageError("Imaginea nu a putut fi încărcată. Încearcă din nou.");
    } finally {
      setIsUploadingParcelImage(false);
    }
  }

  async function removeParcelAiImage(image: ParcelAiImageDraft) {
    setParcelAiImageError(null);
    try {
      const response = await fetch(`/api/parcel-ai/images?imageId=${encodeURIComponent(image.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("remove_failed");
      if (image.previewUrl.startsWith("blob:")) URL.revokeObjectURL(image.previewUrl);
      setParcelAiImages((current) => current.filter((item) => item.id !== image.id));
    } catch {
      setParcelAiImageError("Imaginea nu a putut fi eliminată.");
    }
  }

  function buildRequestInput(
    previousClarificationAnswers: ParcelClarificationAnswer[] = [],
  ): ParcelAssistantInput {
    const clarificationNote = formatClarificationAnswers(
      previousClarificationAnswers,
      clarificationQuestions,
    );
    const mergedDescription = [naturalDescription.trim(), clarificationNote]
      .filter(Boolean)
      .join("\n");

    return {
      contents: mergedDescription,
      naturalDescription: {
        text: mergedDescription,
        locale: "ro-RO",
        source: "customer",
        capturedAt: null,
      },
      advancedDetails: buildAdvancedDetails(advancedDetails),
      previousClarificationAnswers,
      category: parcel.category,
      packaging: advancedDetails.packaging,
      approximateSize: parcel.approximateSize,
      fragilityLevel: advancedDetails.fragile ? "high" : parcel.fragilityLevel,
    };
  }

  async function handleEstimateParcel(
    previousClarificationAnswers: ParcelClarificationAnswer[] = [],
  ) {
    if (!hasNaturalDescription) {
      setEstimateError("Descrie pe scurt coletul înainte de estimare.");
      return;
    }

    const baseClarificationAnswers = pendingEstimate
      ? (pendingEstimate.previousClarificationAnswers ??
        submittedClarificationAnswers)
      : submittedClarificationAnswers;
    const answersForRequest = previousClarificationAnswers.length
      ? mergeClarificationAnswers(
          baseClarificationAnswers,
          previousClarificationAnswers,
        )
      : baseClarificationAnswers;
    const nextInput = buildRequestInput(answersForRequest);
    setIsEstimating(true);
    setEstimateError(null);
    setPendingEstimate(null);
    setPendingInput(nextInput);
    setConfirmationDraft(null);
    setIsEditingConfirmation(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 35_000);

    try {
      const response = await fetch("/api/ai/parcel-estimate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          contentDescription: nextInput.contents,
          naturalDescription: nextInput.naturalDescription,
          advancedDetails: nextInput.advancedDetails,
          previousClarificationAnswers: answersForRequest,
          parcelAiImageIds: parcelAiImages.map((image) => image.id),
          category: nextInput.category ?? "retail",
          packaging: nextInput.packaging,
          approximateSize: nextInput.approximateSize,
          currentFragileLevel: nextInput.fragilityLevel ?? "low",
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json()) as ParcelEstimatorErrorResponse;
        throw new Error(errorBody.error || "Estimarea coletului nu este disponibilă.");
      }

      const payload = (await response.json()) as ParcelEstimatorResponse;
      setPendingEstimate(payload);
      setConfirmationDraft(buildConfirmationDraft(payload, parcel, advancedDetails));
      setSubmittedClarificationAnswers(
        payload.previousClarificationAnswers ?? answersForRequest,
      );
      setClarificationAnswers({});
    } catch (error) {
      setPendingEstimate(null);
      setEstimateError(
        error instanceof DOMException && error.name === "AbortError"
          ? "Estimatorul răspunde mai greu acum. Încearcă din nou sau adaugă greutatea în detalii avansate."
          : error instanceof Error
            ? error.message
            : "Estimatorul nu este disponibil acum. Poți încerca din nou în câteva momente.",
      );
    } finally {
      window.clearTimeout(timeout);
      setIsEstimating(false);
    }
  }

  function updateClarificationAnswer(questionId: string, value: string) {
    setClarificationAnswers((currentValue) => ({
      ...currentValue,
      [questionId]: value,
    }));
  }

  function updateConfirmationDraft<K extends keyof ConfirmationDraft>(
    field: K,
    value: ConfirmationDraft[K],
  ) {
    setConfirmationDraft((currentValue) =>
      currentValue
        ? {
            ...currentValue,
            [field]: value,
          }
        : currentValue,
    );
    setIsEditingConfirmation(true);
  }

  function handleConfirmEstimate() {
    if (!editedPendingEstimate || !pendingInput || !confirmationDraft) {
      return;
    }

    const confirmedInput: ParcelAssistantInput = {
      ...pendingInput,
      category: confirmationDraft.category,
      packaging: confirmationDraft.packaging,
      fragilityLevel: confirmationDraft.fragilityLevel,
      advancedDetails: {
        ...(pendingInput.advancedDetails ?? {}),
        packagingType: confirmationDraft.packaging,
        declaredWeightKg: parseOptionalNumber(confirmationDraft.weightMaxKg),
        declaredDimensionsCm:
          parseOptionalNumber(confirmationDraft.lengthCm) &&
          parseOptionalNumber(confirmationDraft.widthCm) &&
          parseOptionalNumber(confirmationDraft.heightCm)
            ? {
                lengthCm: parseOptionalNumber(confirmationDraft.lengthCm) as number,
                widthCm: parseOptionalNumber(confirmationDraft.widthCm) as number,
                heightCm: parseOptionalNumber(confirmationDraft.heightCm) as number,
              }
            : null,
      },
    };

    onAssistantUpdate(
      confirmedInput,
      buildAssistantResult(confirmedInput, editedPendingEstimate),
    );
    setPendingEstimate(null);
    setPendingInput(null);
    setConfirmationDraft(null);
    setIsEditingConfirmation(false);
    setClarificationAnswers({});
    setSubmittedClarificationAnswers([]);
  }

  function handleConfirmManualDetails() {
    if (!canConfirmManualDetails) {
      return;
    }

    const manualInput: ParcelAssistantInput = {
      contents:
        naturalDescription.trim() ||
        advancedDetails.notes.trim() ||
        "Profil colet completat manual.",
      naturalDescription: {
        text:
          naturalDescription.trim() ||
          advancedDetails.notes.trim() ||
          "Profil colet completat manual.",
        locale: "ro-RO",
        source: "customer",
        capturedAt: null,
      },
      advancedDetails: {
        packagingType: advancedDetails.packaging,
        declaredWeightKg: manualWeightKg,
        declaredDimensionsCm: {
          lengthCm: manualLengthCm as number,
          widthCm: manualWidthCm as number,
          heightCm: manualHeightCm as number,
        },
        notes: advancedDetails.notes.trim() || null,
      },
      category: parcel.category,
      packaging: advancedDetails.packaging,
      approximateSize: parcel.approximateSize,
      fragilityLevel: advancedDetails.fragile ? "high" : parcel.fragilityLevel,
    };
    const manualResult = getLocalParcelAssistantResult(manualInput);

    onAssistantUpdate(manualInput, {
      ...manualResult,
      estimatedWeightRange: `${manualWeightKg} kg`,
      estimatedWeightKg: manualWeightKg,
      suggestedDimensionsCm: {
        lengthCm: manualLengthCm as number,
        widthCm: manualWidthCm as number,
        heightCm: manualHeightCm as number,
      },
      confidenceNote:
        "Profil confirmat manual din detaliile introduse de client. Configuratia dronei si pretul folosesc aceste valori.",
      clarificationQuestions: [],
    });
    setPendingEstimate(null);
    setPendingInput(null);
    setConfirmationDraft(null);
    setIsEditingConfirmation(false);
    setClarificationAnswers({});
    setSubmittedClarificationAnswers([]);
    setEstimateError(null);
  }

  async function handleRequestOperatorEvaluation() {
    if (!hasNaturalDescription) {
      setOperatorRequestError(
        "Descrie pe scurt coletul inainte de cererea catre operator.",
      );
      return;
    }

    const requestInput = pendingInput ?? buildRequestInput();
    try {
      const evaluation = await requestParcelEvaluation({
        draftId: sessionId,
        description: requestInput.contents,
        parcelSnapshot: {
        category: requestInput.category ?? parcel.category,
        packaging: requestInput.packaging,
        approximateSize: requestInput.approximateSize,
        fragilityLevel: requestInput.fragilityLevel ?? parcel.fragilityLevel,
        },
        estimateTrace: editedPendingEstimate
          ? buildEstimateTraceSnapshot(editedPendingEstimate)
          : null,
      });
      setOperatorRequestError(null);
      setOperatorEvaluation(evaluation);
    } catch {
      setOperatorRequestError(
        "Cererea nu poate fi salvată momentan. Reîncearcă.",
      );
    }
  }

  async function handleAnswerOperatorQuestion() {
    if (!operatorEvaluation || !activeOperatorQuestion) {
      return;
    }

    const answer = operatorAnswerDraft.trim();

    if (!answer) {
      return;
    }

    try {
      const message = await sendParcelEvaluationAnswer({
        evaluationId: operatorEvaluation.id,
        questionId: activeOperatorQuestion.id,
        body: answer,
      });
      if (operatorAnswerFiles.length) {
        await uploadMessageFiles({ scope: "evaluation", parentId: message.id, files: operatorAnswerFiles });
      }
      setOperatorEvaluation(await fetchParcelEvaluation(sessionId, evaluationViewId));
      setOperatorAnswerDraft("");
      setOperatorAnswerFiles([]);
      setOperatorRequestError(null);
    } catch {
      setOperatorRequestError("Răspunsul sau una dintre imagini nu a putut fi trimisă.");
    }
  }

  async function closeOperatorEvaluation() {
    if (!operatorEvaluation || isOperatorEvaluationClosed) {
      return;
    }

    try {
      await cancelParcelEvaluationRequest(operatorEvaluation.id);
      setOperatorEvaluation(null);
      setOperatorAnswerDraft("");
      setOperatorAnswerFiles([]);
      setOperatorRequestError("Cererea de evaluare a fost închisă. Poți edita din nou datele coletului.");
    } catch {
      setOperatorRequestError("Cererea nu a putut fi închisă.");
    }
  }

  function handleUseDeterministicFallback() {
    if (!hasNaturalDescription) {
      return;
    }

    const fallbackInput = buildRequestInput(
      mergeClarificationAnswers(
        submittedClarificationAnswers,
        normalizedClarificationAnswers,
      ),
    );
    onAssistantUpdate(fallbackInput, getLocalParcelAssistantResult(fallbackInput));
    setPendingEstimate(null);
    setPendingInput(null);
    setConfirmationDraft(null);
    setIsEditingConfirmation(false);
    setClarificationAnswers({});
    setSubmittedClarificationAnswers([]);
    setEstimateError(null);
  }

  return (
    <div className="grid min-w-0 gap-4 sm:gap-5">
      <div className="grid min-w-0 gap-4 sm:gap-5">
        <div className="grid min-w-0 gap-3.5 rounded-[calc(var(--radius)+0.5rem)] border border-primary/20 bg-card p-3.5 shadow-[var(--elevation-card)] sm:gap-4 sm:p-4">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-3 sm:gap-4">
            <div className="grid min-w-0 gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <WandSparkles className="size-4" />
                Asistent colet
              </div>
              <h3 className="font-heading text-xl leading-tight tracking-tight text-foreground min-[390px]:text-2xl">
                Descrie coletul în cuvintele tale
              </h3>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                Estimarea se aplică doar după confirmare, ca să poți verifica
                greutatea, dimensiunile și protecția necesară. Începe cu
                obiectele principale din colet.
              </p>
            </div>
            {hasConfirmedParcel ? (
              <StatusBadge label="Profil confirmat" tone="success" />
            ) : null}
          </div>

          <label className="grid min-w-0 gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Descriere colet
            </span>
            <textarea
              value={naturalDescription}
              aria-label="Descriere naturală colet"
              rows={6}
              placeholder="Ex: o cutie mică cu medicamente, două sticle de 500 ml și un borcan fragil"
              onChange={(event) => {
                setNaturalDescription(event.target.value);
                setPendingEstimate(null);
                setPendingInput(null);
                setConfirmationDraft(null);
                setIsEditingConfirmation(false);
                setClarificationAnswers({});
                setSubmittedClarificationAnswers([]);
                setEstimateError(null);
              }}
              disabled={operatorEvaluationLocksParcel}
              className="min-h-32 w-full resize-y rounded-[var(--ui-radius-card)] border border-input bg-background px-3.5 py-3 text-base leading-7 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring sm:min-h-36 sm:px-4"
            />
          </label>

          <div className="grid gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-dashed border-primary/30 bg-primary/5 p-3.5 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">Fotografii opționale pentru analiză</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Prima poză: produsul. A doua poză: ambalajul, dacă există separat.</p>
              </div>
              <span className="text-xs text-muted-foreground">{parcelAiImages.length}/2 imagini</span>
            </div>
            <input ref={parcelImagePickerRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="sr-only" onChange={(event) => { const slot = parcelAiImages.find((image) => image.slot === 0) ? 1 : 0; const file = event.target.files?.[0]; if (file) void uploadParcelAiImage(file, slot); event.currentTarget.value = ""; }} />
            <input ref={parcelCameraPickerRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" className="sr-only" onChange={(event) => { const slot = parcelAiImages.find((image) => image.slot === 0) ? 1 : 0; const file = event.target.files?.[0]; if (file) void uploadParcelAiImage(file, slot); event.currentTarget.value = ""; }} />
            {parcelAiImages.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {[0, 1].map((slot) => {
                  const image = parcelAiImages.find((item) => item.slot === slot);
                  return image ? <div key={image.id} className="relative overflow-hidden rounded-2xl border bg-background">
                    <img src={image.previewUrl} alt={slot === 0 ? "Produs atașat" : "Ambalaj atașat"} className="h-36 w-full object-cover" />
                    <div className="flex items-center justify-between gap-2 p-2"><span className="truncate text-xs text-muted-foreground">{slot === 0 ? "Produs" : "Ambalaj"}: {image.name}</span><button type="button" onClick={() => void removeParcelAiImage(image)} disabled={operatorEvaluationLocksParcel} aria-label={`Elimină ${image.name}`} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4" /></button></div>
                  </div> : <div key={`empty-${slot}`} className="grid min-h-24 place-items-center rounded-2xl border border-dashed bg-background/50 px-3 text-center text-xs text-muted-foreground">{slot === 0 ? "Fotografie produs" : "Fotografie ambalaj (opțională)"}</div>;
                })}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => parcelImagePickerRef.current?.click()} disabled={operatorEvaluationLocksParcel || isUploadingParcelImage} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"><ImagePlus className="size-4" />{isUploadingParcelImage ? "Se încarcă…" : parcelAiImages.length >= 2 ? "Înlocuiește ambalajul" : "Încarcă imagine"}</button>
              {canUseCamera ? <button type="button" onClick={() => parcelCameraPickerRef.current?.click()} disabled={operatorEvaluationLocksParcel || isUploadingParcelImage} className="inline-flex h-10 items-center gap-2 rounded-xl border bg-background px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"><Camera className="size-4" />Folosește camera</button> : null}
            </div>
            <p className="text-xs text-muted-foreground">Imaginile sunt private, folosite doar pentru estimare și expiră automat în 24 de ore.</p>
            {parcelAiImageError ? <p className="text-xs text-destructive">{parcelAiImageError}</p> : null}
          </div>

          <button
            type="button"
            onClick={() => setAdvancedOpen((currentValue) => !currentValue)}
            className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-border/70 bg-secondary/20 px-3.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-secondary/45 focus-visible:ring-4 focus-visible:ring-ring sm:min-h-12 sm:px-4"
            aria-expanded={advancedOpen}
          >
            <span>Detalii avansate</span>
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                advancedOpen ? "rotate-180" : "",
              )}
            />
          </button>

          {advancedOpen ? (
            <div className="grid min-w-0 gap-3 rounded-[calc(var(--radius)+0.5rem)] border border-border/70 bg-background/45 p-3.5 sm:grid-cols-2 sm:gap-4 sm:p-4">
              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Greutate cunoscută (kg)
                </span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={advancedDetails.knownWeightKg}
                  disabled={operatorEvaluationLocksParcel}
                  placeholder="Opțional"
                  onChange={(event) =>
                    updateAdvancedDetails("knownWeightKg", event.target.value)
                  }
                  className="h-12 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ambalaj
                </span>
                <select
                  value={advancedDetails.packaging}
                  disabled={operatorEvaluationLocksParcel}
                  onChange={(event) =>
                    updateAdvancedDetails(
                      "packaging",
                      event.target.value as CreateDeliveryParcelDraft["packaging"],
                    )
                  }
                  className="h-12 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                >
                  {parcelPackagingOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid min-w-0 gap-3 sm:col-span-2 sm:grid-cols-3 sm:gap-4">
                {([
                  ["lengthCm", "Lungime (cm)"],
                  ["widthCm", "Lățime (cm)"],
                  ["heightCm", "Înălțime (cm)"],
                ] as const).map(([field, label]) => (
                  <label key={field} className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      {label}
                    </span>
                    <input
                      type="number"
                      min="1"
                      step="1"
                        value={advancedDetails[field]}
                        disabled={operatorEvaluationLocksParcel}
                      placeholder="Opțional"
                      onChange={(event) =>
                        updateAdvancedDetails(field, event.target.value)
                      }
                      className="h-12 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                    />
                  </label>
                ))}
              </div>

              <label className="flex min-h-12 min-w-0 items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={advancedDetails.fragile}
                  disabled={operatorEvaluationLocksParcel}
                  onChange={(event) =>
                    updateAdvancedDetails("fragile", event.target.checked)
                  }
                  className="size-4 accent-primary"
                />
                Fragil sau sensibil la manipulare
              </label>

              <label className="grid min-w-0 gap-2 sm:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Note
                </span>
                <textarea
                  value={advancedDetails.notes}
                  disabled={operatorEvaluationLocksParcel}
                  rows={3}
                  placeholder="Opțional: temperatură, orientare, ambalaj special"
                  onChange={(event) =>
                    updateAdvancedDetails("notes", event.target.value)
                  }
                  className="min-h-24 w-full resize-y rounded-[var(--ui-radius-card)] border border-input bg-card px-4 py-3 text-sm leading-6 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                />
              </label>

              {hasManualAdvancedDetails ? (
                <div className="grid gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-primary/25 bg-primary/10 p-3.5 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      Date manuale detectate
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Confirma profilul fara AI dupa ce completezi greutatea si
                      toate cele trei dimensiuni.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmManualDetails}
                    disabled={!canConfirmManualDetails}
                    className="h-11 w-full rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-55 sm:w-fit"
                  >
                    Confirma datele manuale
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {estimateError ? (
            <div className="grid gap-3 rounded-[calc(var(--radius)+0.5rem)] border border-warning/25 bg-warning/10 px-4 py-4 text-sm leading-6 text-muted-foreground">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    Estimare locală disponibilă
                  </p>
                  <p className="mt-1">{estimateError}</p>
                  <p className="mt-1">
                    Fallback-ul folosește aceleași reguli locale de greutate,
                    volum și fragilitate. Îl poți rafina din detaliile avansate.
                  </p>
                </div>
                <StatusBadge
                  label="Fără blocaj"
                  tone="warning"
                  className="w-fit shrink-0"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleEstimateParcel()}
                  disabled={isEstimating}
                  className="h-11 w-full rounded-2xl border border-border/80 bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60 disabled:pointer-events-none disabled:opacity-55 sm:w-fit"
                >
                  Încearcă din nou
                </button>
                <button
                  type="button"
                  onClick={handleUseDeterministicFallback}
                  disabled={!hasNaturalDescription}
                  className="h-11 w-full rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-55 sm:w-fit"
                >
                  Folosește fallback-ul local
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end border-t border-border/70 pt-3">
            <button
              type="button"
              onClick={() => handleEstimateParcel()}
              disabled={!hasNaturalDescription || isEstimating}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-[opacity,transform] hover:opacity-90 disabled:pointer-events-none disabled:opacity-55 sm:w-fit"
            >
              {isEstimating ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {isEstimating ? "Estimare în curs" : "Estimează cu AI"}
            </button>
          </div>
        </div>

        {operatorEvaluation ? (
          <div className="grid min-w-0 gap-4 rounded-[calc(var(--radius)+0.75rem)] border border-border/80 bg-card p-3.5 shadow-[var(--elevation-card)] min-[360px]:p-4 sm:p-5">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <MessageSquareText className="size-4" />
                  Evaluare operator
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {operatorEvaluation.status === "waiting_customer"
                    ? "Operatorul are nevoie de un raspuns pentru a continua."
                    : operatorEvaluation.status === "customer_replied"
                      ? "Raspunsul tau a fost trimis. Operatorul reia evaluarea."
                      : operatorEvaluation.status === "finalized"
                        ? "Operatorul a finalizat profilul coletului."
                        : "Cererea ta este evaluata de un operator."}
                </p>
              </div>
              <StatusBadge
                label={operatorParcelEvaluationStatusLabels[operatorEvaluation.status]}
                tone={
                  operatorEvaluation.status === "finalized"
                    ? "success"
                    : operatorEvaluation.status === "waiting_customer"
                      ? "warning"
                      : "info"
                }
                className="w-fit"
              />
            </div>

            {operatorEvaluation.questions.length ? (
              <div className="grid gap-2">
                {operatorEvaluation.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="grid gap-2 rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-background/65 p-3 text-sm"
                  >
                    <p className="font-medium text-foreground">
                      {index + 1}. {question.question}
                    </p>
                    {question.answer ? (
                      <p className="leading-6 text-muted-foreground">
                        Raspuns: {question.answer}
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        Asteapta raspunsul tau.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[calc(var(--radius)+0.35rem)] border border-border/75 bg-secondary/25 p-3 text-sm leading-6 text-muted-foreground">
                Cererea a fost trimisa cu descrierea folosita pentru AI.
                Acest lucru poate dura cateva minute. Operatorul poate pune
                intrebari daca are nevoie de clarificari.
              </div>
            )}

            {activeOperatorQuestion && !isOperatorEvaluationClosed ? (
              <div className="grid gap-3 rounded-[calc(var(--radius)+0.45rem)] border border-primary/25 bg-primary/8 p-3.5">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Raspunde la intrebarea activa
                  </span>
                  <textarea
                    value={operatorAnswerDraft}
                    rows={3}
                    placeholder="Raspuns pentru operator"
                    onChange={(event) => setOperatorAnswerDraft(event.target.value)}
                    className="min-h-24 w-full resize-y rounded-[var(--ui-radius-card)] border border-input bg-card px-4 py-3 text-sm leading-6 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                  />
                </label>
                {operatorAnswerFiles.length ? (
                  <div className="flex flex-wrap gap-2">
                    {operatorAnswerFiles.map((file) => (
                      <span key={`${file.name}-${file.size}`} className="inline-flex items-center gap-1 rounded-full bg-background px-2.5 py-1 text-xs">
                        {file.name}
                        <button type="button" aria-label={`Elimină ${file.name}`} onClick={() => setOperatorAnswerFiles((current) => current.filter((item) => item !== file))}>
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                <label className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-xl border bg-card px-3 text-xs font-medium text-muted-foreground hover:text-foreground">
                  <ImagePlus className="size-4" />
                  Adaugă imagini
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="sr-only"
                    onChange={(event) => setOperatorAnswerFiles(Array.from(event.target.files ?? []).slice(0, 2))}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleAnswerOperatorQuestion()}
                  disabled={!operatorAnswerDraft.trim()}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-55 sm:w-fit"
                >
                  <Send className="size-4" />
                  Trimite raspuns
                </button>
                <p className="text-xs text-muted-foreground">Poți atașa maximum 2 imagini, 25 MB fiecare.</p>
              </div>
            ) : null}

            {!isOperatorEvaluationClosed ? (
              <button
                type="button"
                onClick={() => void closeOperatorEvaluation()}
                className="h-10 w-fit rounded-xl border border-border/80 bg-background px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Închide cererea de evaluare
              </button>
            ) : null}

            {operatorEvaluation.status === "finalized" ? (
              <div className="flex items-start gap-3 rounded-[calc(var(--radius)+0.35rem)] border border-primary/30 bg-primary/10 p-3 text-sm leading-6 text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  Thread inchis. Profilul completat de operator se aplica automat
                  in formular.
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {pendingEstimate ? (
          <div className="grid min-w-0 gap-4 rounded-[calc(var(--radius)+0.5rem)] border border-primary/25 bg-card p-3.5 shadow-[var(--elevation-card)] sm:p-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <CheckCircle2 className="size-4" />
                  Estimare pregătită
                </div>
                <h3 className="mt-2 font-heading text-xl leading-tight tracking-tight text-foreground min-[390px]:text-2xl">
                  Verifică profilul înainte de confirmare
                </h3>
              </div>
              <StatusBadge
                label={getConfidenceLabel(pendingEstimate)}
                tone={pendingEstimate.confidence === "low" ? "warning" : "info"}
                className="max-w-full shrink whitespace-normal"
              />
            </div>

            <dl className="grid min-w-0 grid-cols-2 border-y border-border/70 sm:grid-cols-4">
              <div className="min-w-0 px-3 py-3 sm:border-r sm:border-border/70">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Greutate</dt>
                <dd className="mt-1 truncate font-medium text-foreground">
                  {activeEstimateResult?.estimatedWeightRange}
                </dd>
              </div>
              <div className="min-w-0 border-l border-border/70 px-3 py-3 sm:border-l-0 sm:border-r">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Ambalaj</dt>
                <dd className="mt-1 truncate font-medium text-foreground">
                  {confirmationDraft
                    ? parcelPackagingLabels[confirmationDraft.packaging]
                    : pendingEstimate.packagingInference?.packagingType
                      ? parcelPackagingLabels[pendingEstimate.packagingInference.packagingType]
                      : parcelPackagingLabels[advancedDetails.packaging]}
                </dd>
              </div>
              <div className="min-w-0 border-t border-border/70 px-3 py-3 sm:border-r sm:border-t-0">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Categorie</dt>
                <dd className="mt-1 truncate font-medium text-foreground">
                  {confirmationDraft
                    ? parcelCategoryLabels[confirmationDraft.category]
                    : pendingEstimate.category
                      ? parcelCategoryLabels[pendingEstimate.category]
                      : parcelCategoryLabels[parcel.category]}
                </dd>
              </div>
              <div className="min-w-0 border-l border-t border-border/70 px-3 py-3 sm:border-l-0 sm:border-t-0">
                <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Încredere</dt>
                <dd className="mt-1 truncate font-medium text-foreground">
                  {getConfidenceLabel(pendingEstimate)}
                </dd>
              </div>
            </dl>

            {correctionDisplay ? (
              <div className="grid min-w-0 gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-primary/25 bg-primary/10 px-4 py-4">
                <div className="flex min-w-0 items-start gap-3">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">
                      Estimare ajustată automat
                    </p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      {correctionDisplay.message}
                    </p>
                  </div>
                </div>

                <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Greutate corectată
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {correctionDisplay.correctedWeightLabel}
                    </p>
                  </div>
                  {correctionDisplay.detectedVolumeLabel ? (
                    <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        Volum detectat
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {correctionDisplay.detectedVolumeLabel}
                      </p>
                    </div>
                  ) : null}
                  <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Încredere
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {getConfidenceLabel(editedPendingEstimate)}
                      {editedPendingEstimate?.confidenceScore
                        ? ` · ${editedPendingEstimate.confidenceScore}/100`
                        : ""}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Configurație
                    </p>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      Se alege automat după confirmare
                    </p>
                  </div>
                </div>

                <p className="text-sm leading-6 text-muted-foreground">
                  {editedPendingEstimate?.safetyNote ??
                    "Greutatea finală va fi confirmată la pickup."}
                </p>
              </div>
            ) : null}

            {confirmationDraft ? (
              <div className="grid min-w-0 gap-3 border-y border-border/70 py-3">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setIsEditingConfirmation((currentValue) => !currentValue)
                    }
                    aria-expanded={isEditingConfirmation}
                    className="h-10 w-full rounded-2xl border border-border/80 bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60 sm:w-fit"
                  >
                    {isEditingConfirmation ? "Închide editarea" : "Editează manual"}
                  </button>
                </div>

                {isEditingConfirmation ? (
                <div className="grid min-w-0 gap-3 pt-1 sm:grid-cols-2">
                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Categorie
                    </span>
                    <select
                      value={confirmationDraft.category}
                      disabled={!isEditingConfirmation}
                      onChange={(event) =>
                        updateConfirmationDraft(
                          "category",
                          event.target.value as CreateDeliveryParcelDraft["category"],
                        )
                      }
                      className="h-11 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] disabled:opacity-80 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                    >
                      {parcelCategoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Fragilitate
                    </span>
                    <select
                      value={confirmationDraft.fragilityLevel}
                      disabled={!isEditingConfirmation}
                      onChange={(event) =>
                        updateConfirmationDraft(
                          "fragilityLevel",
                          event.target
                            .value as CreateDeliveryParcelDraft["fragilityLevel"],
                        )
                      }
                      className="h-11 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] disabled:opacity-80 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                    >
                      {Object.entries(parcelFragileLevelLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid min-w-0 gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Ambalaj
                    </span>
                    <select
                      value={confirmationDraft.packaging}
                      disabled={!isEditingConfirmation}
                      onChange={(event) =>
                        updateConfirmationDraft(
                          "packaging",
                          event.target.value as CreateDeliveryParcelDraft["packaging"],
                        )
                      }
                      className="h-11 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] disabled:opacity-80 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                    >
                      {parcelPackagingOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid min-w-0 gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Greutate estimată
                    </span>
                    <div className="grid min-w-0 grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={confirmationDraft.weightMinKg}
                        disabled={!isEditingConfirmation}
                        aria-label="Greutate minimă estimată"
                        onChange={(event) =>
                          updateConfirmationDraft("weightMinKg", event.target.value)
                        }
                        className="h-11 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] disabled:opacity-80 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                      />
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={confirmationDraft.weightMaxKg}
                        disabled={!isEditingConfirmation}
                        aria-label="Greutate maximă estimată"
                        onChange={(event) =>
                          updateConfirmationDraft("weightMaxKg", event.target.value)
                        }
                        className="h-11 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] disabled:opacity-80 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatWeightRangeFromDraft(confirmationDraft)}
                    </p>
                  </div>

                  <div className="grid min-w-0 gap-2 sm:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Dimensiuni estimate
                    </span>
                    <div className="grid min-w-0 gap-2 sm:grid-cols-3">
                      {([
                        ["lengthCm", "Lungime"],
                        ["widthCm", "Lățime"],
                        ["heightCm", "Înălțime"],
                      ] as const).map(([field, label]) => (
                        <input
                          key={field}
                          type="number"
                          min="1"
                          step="1"
                          value={confirmationDraft[field]}
                          disabled={!isEditingConfirmation}
                          aria-label={`${label} estimată`}
                          placeholder={label}
                          onChange={(event) =>
                            updateConfirmationDraft(field, event.target.value)
                          }
                          className="h-11 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 disabled:opacity-80 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                        />
                      ))}
                    </div>
                  </div>
                </div>
                ) : null}
              </div>
            ) : null}

            {detectedItems.length || handlingNotes.length || weatherNotes.length || riskFlags.length ? (
              <details className="group border-y border-border/70 py-1">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-foreground">
                  <span>Detalii analiză</span>
                  <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="grid gap-3 pb-3 pt-2">
                  {detectedItems.length ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Elemente detectate</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {detectedItems.map((item) => (
                          <StatusBadge key={item} label={item} tone="neutral" className="max-w-full shrink whitespace-normal" />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {handlingNotes.length || weatherNotes.length || riskFlags.length ? (
                    <div>
                      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Manipulare și risc</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {handlingNotes.map((note) => (
                          <StatusBadge key={`${note.code}-${note.label}`} label={note.label} tone="neutral" className="max-w-full shrink whitespace-normal" />
                        ))}
                        {weatherNotes.map((note) => (
                          <StatusBadge key={note} label={note} tone="neutral" className="max-w-full shrink whitespace-normal" />
                        ))}
                        {riskFlags.map((risk) => (
                          <StatusBadge key={`${risk.code}-${risk.label}`} label={risk.label} tone={risk.severity === "high" ? "warning" : "neutral"} className="max-w-full shrink whitespace-normal" />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {pendingEstimate.confidenceScore ? (
                    <p className="text-xs text-muted-foreground">
                      Scor de încredere: {pendingEstimate.confidenceScore}/100
                    </p>
                  ) : null}
                </div>
              </details>
            ) : null}

            {hasClarificationQuestions ? (
              <div className="grid min-w-0 gap-3 rounded-[calc(var(--radius)+0.375rem)] border border-warning/25 bg-warning/10 px-3.5 py-3.5 sm:px-4">
                <p className="font-medium text-foreground">Întrebări utile</p>
                {hasBlockingClarificationQuestions ? (
                  <p className="text-xs leading-5 text-warning-foreground/90">
                    Răspunde la întrebările de mai jos pentru a putea confirma
                    estimarea.
                  </p>
                ) : null}
                <div className="grid gap-2">
                  {clarificationQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="rounded-2xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm leading-6 text-foreground"
                    >
                      {question.question}
                    </div>
                  ))}
                </div>
                <div className="grid gap-3">
                  {clarificationQuestions.map((question) => {
                    const options = getQuestionOptions(question);
                    const value = clarificationAnswers[question.id] ?? "";

                    return (
                      <label key={`${question.id}-answer`} className="grid min-w-0 gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Răspuns
                        </span>
                        {question.answerType === "boolean" ? (
                          <div className="flex gap-2">
                            {options.map((option) => <button key={option.value} type="button" onClick={() => updateClarificationAnswer(question.id, option.value)} className={cn("h-11 rounded-xl border px-4 text-sm", value === option.value ? "border-primary bg-primary/10 text-primary" : "bg-card")}>{option.label}</button>)}
                          </div>
                        ) : question.answerType === "multi_select" ? (
                          <div className="grid gap-2">
                            {options.map((option) => {
                              const selected = value.split("|").filter(Boolean);
                              const checked = selected.includes(option.value);
                              return <label key={option.value} className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm"><input type="checkbox" checked={checked} onChange={() => updateClarificationAnswer(question.id, checked ? selected.filter((item) => item !== option.value).join("|") : [...selected, option.value].join("|"))} />{option.label}</label>;
                            })}
                          </div>
                        ) : options.length ? (
                          <select
                            value={value}
                            onChange={(event) =>
                              updateClarificationAnswer(
                                question.id,
                                event.target.value,
                              )
                            }
                            className="h-12 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                          >
                            <option value="">Alege un răspuns</option>
                            {options.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={question.answerType === "number" ? "number" : "text"}
                            min={question.answerType === "number" ? "0.1" : undefined}
                            step={question.answerType === "number" ? "0.1" : undefined}
                            value={value}
                            placeholder={
                              question.field === "weight"
                                ? "Ex: 1.2 kg"
                                : "Răspuns scurt"
                            }
                            onChange={(event) =>
                              updateClarificationAnswer(
                                question.id,
                                event.target.value,
                              )
                            }
                            className="h-12 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-primary/15 focus-visible:ring-4 focus-visible:ring-ring"
                          />
                        )}
                        {value.includes("__custom") || value === "__custom" ? <input type="text" value={clarificationAnswers[`${question.id}__custom`] ?? ""} placeholder="Scrie răspunsul tău" onChange={(event) => updateClarificationAnswer(`${question.id}__custom`, event.target.value)} className="h-12 min-w-0 rounded-2xl border border-input bg-card px-4 text-sm outline-none" /> : null}
                      </label>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => handleEstimateParcel(normalizedClarificationAnswers)}
                  disabled={!canRefineWithAnswers || isEstimating}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-55 sm:w-fit"
                >
                  {isEstimating ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  Actualizează estimarea
                </button>
              </div>
            ) : null}

            {pendingOverweight ? (
              <div className="rounded-[calc(var(--radius)+0.375rem)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Greutatea estimată depășește limita curentă a flotei de{" "}
                {maxPayloadKg} kg. Ajustează greutatea sau cere verificare
                operator înainte de confirmare.
              </div>
            ) : null}

            <p className="text-sm leading-6 text-muted-foreground">
              {pendingEstimate.explanation}
            </p>

            {operatorRequestError ? (
              <div className="rounded-[calc(var(--radius)+0.35rem)] border border-warning/30 bg-warning/10 px-4 py-3 text-sm leading-6 text-muted-foreground">
                {operatorRequestError}
              </div>
            ) : null}

            <div className="grid gap-2 border-t border-border/70 pt-3 sm:flex sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => void handleRequestOperatorEvaluation()}
                disabled={Boolean(operatorEvaluation)}
                className="h-11 w-full rounded-2xl border border-border/80 bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary/60 disabled:pointer-events-none disabled:opacity-55 sm:w-fit"
              >
                Cere evaluare operator
              </button>
              <button
                type="button"
                onClick={handleConfirmEstimate}
                disabled={!canConfirmEstimate || pendingOverweight}
                className="h-11 w-full rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-55 sm:w-fit"
              >
                Confirmă estimarea
              </button>
            </div>
          </div>
        ) : null}
      </div>

    </div>
  );
});

CreateDeliveryParcelSection.displayName = "CreateDeliveryParcelSection";
