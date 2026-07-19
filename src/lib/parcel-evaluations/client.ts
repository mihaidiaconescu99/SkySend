import type { OperatorParcelEvaluation } from "@/types/operator-parcel-evaluation";

type RawMessage = {
  id: string;
  message_kind: string;
  reply_to_message_id: string | null;
  body: string;
  created_at: string;
  file_attachments?: Array<{ id: string; original_name: string; content_type: string; size_bytes: number }>;
};
type RawEvaluation = {
  id: string;
  delivery_draft_id: string;
  initial_description: string;
  status: string;
  parcel_snapshot: OperatorParcelEvaluation["parcelSnapshot"];
  estimate_trace?: OperatorParcelEvaluation["estimateTrace"];
  weight_kg: number | string | null;
  length_cm: number | string | null;
  width_cm: number | string | null;
  height_cm: number | string | null;
  warnings: string[];
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  cancelled_at: string | null;
  parcel_evaluation_messages?: RawMessage[];
};

function mapStatus(status: string): OperatorParcelEvaluation["status"] {
  if (status === "waiting_customer" || status === "customer_replied" || status === "finalized") return status;
  if (status === "cancelled") return "closed";
  return "in_evaluation";
}

export function mapParcelEvaluation(raw: RawEvaluation | null): OperatorParcelEvaluation | null {
  if (!raw) return null;
  const messages = raw.parcel_evaluation_messages ?? [];
  const questions = messages.filter((message) => message.message_kind === "question").map((question) => {
    const answer = messages.find((message) => message.message_kind === "answer" && message.reply_to_message_id === question.id);
    return {
      id: question.id,
      question: question.body,
      answer: answer?.body ?? null,
      askedAt: question.created_at,
      answeredAt: answer?.created_at ?? null,
      attachments: answer?.file_attachments ?? [],
    };
  });
  const finalized = raw.status === "finalized";
  return {
    id: raw.id,
    sessionId: raw.delivery_draft_id,
    orderId: null,
    initialDescription: raw.initial_description,
    status: mapStatus(raw.status),
    questions,
    parcelSnapshot: raw.parcel_snapshot,
    profile: finalized ? {
      weightKg: Number(raw.weight_kg),
      lengthCm: Number(raw.length_cm),
      widthCm: Number(raw.width_cm),
      heightCm: Number(raw.height_cm),
      warnings: raw.warnings as NonNullable<OperatorParcelEvaluation["profile"]>["warnings"],
    } : null,
    estimateTrace: raw.estimate_trace ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    closedAt: raw.finalized_at ?? raw.cancelled_at,
    appliedAt: null,
  };
}

async function parseEvaluationResponse(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "evaluation_unavailable");
  return mapParcelEvaluation(payload.evaluation);
}

export async function fetchParcelEvaluation(draftId: string, viewId: string) {
  const response = await fetch(`/api/client/parcel-evaluations?draftId=${encodeURIComponent(draftId)}&viewId=${encodeURIComponent(viewId)}`, { cache: "no-store" });
  return parseEvaluationResponse(response);
}

export async function requestParcelEvaluation(input: {
  draftId: string;
  description: string;
  parcelSnapshot: OperatorParcelEvaluation["parcelSnapshot"];
  estimateTrace?: OperatorParcelEvaluation["estimateTrace"];
}) {
  const response = await fetch("/api/client/parcel-evaluations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseEvaluationResponse(response);
}

export async function sendParcelEvaluationAnswer(input: {
  evaluationId: string;
  questionId: string;
  body: string;
}) {
  const response = await fetch(`/api/client/parcel-evaluations/${input.evaluationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: input.body, replyToMessageId: input.questionId }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "evaluation_unavailable");
  return payload.message as { id: string };
}

export async function cancelParcelEvaluationRequest(evaluationId: string) {
  const response = await fetch(`/api/client/parcel-evaluations/${evaluationId}`, { method: "PATCH" });
  return parseEvaluationResponse(response);
}
