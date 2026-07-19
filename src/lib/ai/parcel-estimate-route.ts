import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { estimateParcelForDispatch } from "@/lib/ai";
import { validateRequest } from "@/lib/api/validation";
import { prepareParcelAiImagesForAnalysis } from "@/lib/parcel-ai-images/server";
import type {
  ParcelEstimatorErrorResponse,
  ParcelEstimatorRequest,
  ParcelEstimatorResponse,
} from "@/types/parcel-estimator";
import type {
  ParcelClarificationAnswer,
  ParcelNaturalDescription,
} from "@/types/parcel-intelligence";

const estimatorTimeoutMs = 30_000;

const packagingEnum = z.enum([
  "soft_pouch",
  "plastic_bag",
  "boxed",
  "insulated",
  "fragile_protective",
  "heavy_duty",
]);

const sizeEnum = z.enum(["extra_small", "small", "medium", "large"]);

const categoryEnum = z.enum([
  "documents",
  "retail",
  "food",
  "medical",
  "electronics",
  "special",
]);

const fragileLevelEnum = z.enum(["low", "moderate", "high"]);

const naturalDescriptionSchema = z
  .union([
    z.string().trim().min(1).max(2000),
    z.object({
      text: z.string().trim().min(1).max(2000),
      locale: z.string().optional(),
      source: z
        .enum(["customer", "operator", "repeat_delivery", "system_prefill"])
        .optional(),
      capturedAt: z.string().nullish(),
    }),
  ])
  .optional();

const declaredDimensionsSchema = z
  .object({
    lengthCm: z.number().positive(),
    widthCm: z.number().positive(),
    heightCm: z.number().positive(),
  })
  .optional();

const advancedDetailsSchema = z
  .object({
    packagingType: packagingEnum.optional(),
    declaredWeightKg: z.number().positive().nullable().optional(),
    declaredDimensionsCm: declaredDimensionsSchema.nullable(),
    declaredItemCount: z.number().positive().nullable().optional(),
    declaredValueMinor: z.number().positive().nullable().optional(),
    temperatureControlled: z.boolean().nullable().optional(),
    perishable: z.boolean().nullable().optional(),
    sealed: z.boolean().nullable().optional(),
    stackable: z.boolean().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .nullable()
  .optional();

const clarificationAnswerFieldEnum = z.enum([
  "contents",
  "category",
  "packaging",
  "weight",
  "dimensions",
  "fragility",
  "handling",
  "weather_sensitivity",
  "other",
]);

const clarificationAnswerSchema = z.object({
  questionId: z.string().trim().min(1),
  field: clarificationAnswerFieldEnum.optional(),
  answer: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
  ]),
});

export const parcelEstimateRequestSchema = z
  .object({
    contents: z.string().trim().min(1).max(2000).optional(),
    contentDescription: z.string().trim().min(1).max(2000).optional(),
    naturalDescription: naturalDescriptionSchema,
    advancedDetails: advancedDetailsSchema,
    previousClarificationAnswers: z.array(clarificationAnswerSchema).max(8).optional(),
    category: categoryEnum.optional(),
    packaging: packagingEnum.optional(),
    approximateSize: sizeEnum.optional(),
    currentFragileLevel: fragileLevelEnum.nullable().optional(),
    parcelAiImageIds: z.array(z.string().uuid()).max(2).optional(),
  })
  .refine(
    (data) => {
      const desc =
        data.contentDescription?.trim() ||
        data.contents?.trim() ||
        (typeof data.naturalDescription === "string"
          ? data.naturalDescription.trim()
          : data.naturalDescription?.text.trim()) ||
        "";
      return desc.length > 0;
    },
    {
      message:
        "Estimatorul are nevoie de o scurtă descriere a coletului (`contents`, `contentDescription` sau `naturalDescription`).",
      path: ["contentDescription"],
    },
  );

export type ParcelEstimateRequestInput = z.infer<typeof parcelEstimateRequestSchema>;

function toNaturalDescription(
  input: ParcelEstimateRequestInput,
  fallbackText: string,
): ParcelNaturalDescription {
  if (typeof input.naturalDescription === "string") {
    return {
      text: input.naturalDescription,
      locale: "ro-RO",
      source: "customer",
      capturedAt: null,
    };
  }

  if (input.naturalDescription) {
    return {
      text: input.naturalDescription.text,
      locale: input.naturalDescription.locale ?? "ro-RO",
      source: input.naturalDescription.source ?? "customer",
      capturedAt: input.naturalDescription.capturedAt ?? null,
    };
  }

  return {
    text: fallbackText,
    locale: "ro-RO",
    source: "customer",
    capturedAt: null,
  };
}

async function buildEstimatorRequest(
  input: ParcelEstimateRequestInput,
): Promise<ParcelEstimatorRequest> {
  const contentDescription = (
    input.contentDescription ??
    input.contents ??
    (typeof input.naturalDescription === "string"
      ? input.naturalDescription
      : input.naturalDescription?.text) ??
    ""
  ).trim();

  const advancedDetails = input.advancedDetails ?? null;
  const packaging =
    input.packaging ?? advancedDetails?.packagingType ?? "boxed";
  let images: ParcelEstimatorRequest["images"] = [];
  if (input.parcelAiImageIds?.length) {
    const [{ auth }, { getSupportIdentity }] = await Promise.all([
      import("@clerk/nextjs/server"),
      import("@/lib/support/support-hub"),
    ]);
    const { userId } = await auth();
    const identity = userId ? await getSupportIdentity(userId) : null;
    if (!identity) throw new Error("unauthenticated");
    images = await prepareParcelAiImagesForAnalysis(identity, input.parcelAiImageIds);
  }

  return {
    contentDescription,
    naturalDescription: toNaturalDescription(input, contentDescription),
    advancedDetails: advancedDetails
      ? {
          packagingType: advancedDetails.packagingType ?? null,
          declaredWeightKg: advancedDetails.declaredWeightKg ?? null,
          declaredDimensionsCm: advancedDetails.declaredDimensionsCm ?? null,
          declaredItemCount: advancedDetails.declaredItemCount ?? null,
          declaredValueMinor: advancedDetails.declaredValueMinor ?? null,
          temperatureControlled:
            advancedDetails.temperatureControlled ?? null,
          perishable: advancedDetails.perishable ?? null,
          sealed: advancedDetails.sealed ?? null,
          stackable: advancedDetails.stackable ?? null,
          notes: advancedDetails.notes?.trim() || null,
        }
      : null,
    previousClarificationAnswers: (input.previousClarificationAnswers ??
      []) as ParcelClarificationAnswer[],
    category: input.category ?? "retail",
    packaging,
    approximateSize: input.approximateSize ?? "small",
    currentFragileLevel: input.currentFragileLevel ?? null,
    images,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Estimatorul coletului a expirat."));
    }, timeoutMs);

    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

export async function postParcelEstimate(request: Request) {

  const validation = await validateRequest(parcelEstimateRequestSchema, request);

  if (!validation.ok) {
    return validation.response;
  }

  let input: ParcelEstimatorRequest;
  try {
    input = await buildEstimatorRequest(validation.data);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "image_unavailable";
    return NextResponse.json<ParcelEstimatorErrorResponse>(
      { error: reason === "unauthenticated" ? "Autentificare necesară pentru imagini." : "Imaginile selectate nu mai sunt disponibile." },
      { status: reason === "unauthenticated" ? 401 : 409 },
    );
  }

  try {
    const estimate = await withTimeout(
      estimateParcelForDispatch(input),
      estimatorTimeoutMs,
    );

    return NextResponse.json<ParcelEstimatorResponse>(estimate);
  } catch {
    return NextResponse.json<ParcelEstimatorErrorResponse>(
      {
        error: "Estimatorul nu este disponibil acum. Adaugă manual greutatea coletului.",
        code: "estimator_unavailable",
      },
      { status: 503 },
    );
  }
}
