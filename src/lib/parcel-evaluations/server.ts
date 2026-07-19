import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { fromParcelAssistantInput, type CreateDeliveryParcelDraft } from "@/lib/create-delivery-parcel";
import type { ParcelAssistantInput, ParcelAssistantResult } from "@/types/parcel-assistant";
import {
  isAuthorizedSupportOperator,
  isSupportAdmin,
  type SupportIdentity,
} from "@/lib/support/support-hub";

const db = () => createAdminSupabaseClient() as never as {
  from: (table: string) => any;
};

const evaluationSelect = "id,delivery_draft_id,client_profile_id,assigned_operator_profile_id,status,initial_description,parcel_snapshot,estimate_trace,weight_kg,length_cm,width_cm,height_cm,warnings,assigned_at,finalized_at,client_applied_at,client_final_view_id,cancelled_at,created_at,updated_at,client_profile:client_profile_id(id,full_name,email,avatar_url),assigned_operator:assigned_operator_profile_id(id,full_name,email,avatar_url),delivery_drafts(id,current_step,payload,status),parcel_evaluation_messages(id,evaluation_id,author_type,author_profile_id,message_kind,reply_to_message_id,body,created_at,author_profile:author_profile_id(id,full_name,email,avatar_url),file_attachments(id,original_name,content_type,size_bytes))";

function requireStaff(identity: SupportIdentity) {
  if (!isAuthorizedSupportOperator(identity)) throw new Error("forbidden");
}

export async function getOrCreateDeliveryDraft(identity: SupportIdentity) {
  const { data: existing, error } = await db().from("delivery_drafts")
    .select("id,profile_id,status,current_step,payload,created_at,updated_at")
    .eq("profile_id", identity.profileId).eq("status", "active")
    .order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing;
  const { data, error: insertError } = await db().from("delivery_drafts").insert({
    profile_id: identity.profileId,
    status: "active",
    current_step: "route",
    payload: {},
  }).select("id,profile_id,status,current_step,payload,created_at,updated_at").single();
  if (!insertError) return data;
  if (insertError.code === "23505") return getOrCreateDeliveryDraft(identity);
  throw new Error(insertError.message);
}

export async function saveDeliveryDraft(identity: SupportIdentity, input: {
  id: string;
  currentStep: "route" | "parcel" | "options" | "review";
  payload: Record<string, unknown>;
}) {
  const { data, error } = await db().from("delivery_drafts").update({
    current_step: input.currentStep,
    payload: input.payload,
  }).eq("id", input.id).eq("profile_id", identity.profileId).eq("status", "active")
    .select("id,profile_id,status,current_step,payload,created_at,updated_at").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("draft_not_found");
  return data;
}

export async function completeDeliveryDraft(identity: SupportIdentity, id: string) {
  const { data, error } = await db().from("delivery_drafts").update({ status: "submitted" })
    .eq("id", id).eq("profile_id", identity.profileId).eq("status", "active")
    .select("id,status").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("draft_not_found");
  return data;
}

async function evaluationById(id: string) {
  const { data, error } = await db().from("parcel_evaluations")
    .select(evaluationSelect).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getClientEvaluation(identity: SupportIdentity, draftId?: string | null, viewId?: string | null) {
  let query = db().from("parcel_evaluations").select(evaluationSelect)
    .eq("client_profile_id", identity.profileId)
    .order("updated_at", { ascending: false }).limit(1);
  if (draftId) query = query.eq("delivery_draft_id", draftId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (data?.status === "finalized") {
    if (data.client_applied_at) return null;
    if (viewId && !data.client_final_view_id) {
      const { data: claimedView } = await db().from("parcel_evaluations").update({
        client_final_view_id: viewId,
      }).eq("id", data.id).is("client_final_view_id", null).select("client_final_view_id").maybeSingle();
      data.client_final_view_id = claimedView?.client_final_view_id ?? data.client_final_view_id;
    }
    if (viewId && data.client_final_view_id && data.client_final_view_id !== viewId) {
      await db().from("parcel_evaluations").update({
        client_applied_at: new Date().toISOString(),
      }).eq("id", data.id).eq("status", "finalized").is("client_applied_at", null);
      return null;
    }
  }
  return data;
}

export async function createParcelEvaluation(identity: SupportIdentity, input: {
  draftId: string;
  description: string;
  parcelSnapshot: Record<string, unknown>;
  estimateTrace?: Record<string, unknown> | null;
}) {
  const { data: draft, error: draftError } = await db().from("delivery_drafts")
    .select("id,profile_id,status,current_step").eq("id", input.draftId)
    .eq("profile_id", identity.profileId).eq("status", "active").maybeSingle();
  if (draftError) throw new Error(draftError.message);
  if (!draft) throw new Error("draft_not_found");
  const { data: previous, error: previousError } = await db().from("parcel_evaluations")
    .select("id,status,client_applied_at").eq("delivery_draft_id", draft.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (previousError) throw new Error(previousError.message);
  const previousCanRepeat = previous?.status === "finalized" && Boolean(previous.client_applied_at);
  if (previous && previous.status !== "cancelled" && !previousCanRepeat) return evaluationById(previous.id);

  const { data, error } = await db().from("parcel_evaluations").insert({
    delivery_draft_id: draft.id,
    client_profile_id: identity.profileId,
    status: "requested",
    initial_description: input.description,
    parcel_snapshot: input.parcelSnapshot,
    estimate_trace: input.estimateTrace ?? null,
  }).select("id").single();
  if (error) throw new Error(error.code === "23505" ? "evaluation_active" : error.message);
  await db().from("parcel_evaluation_messages").insert({
    evaluation_id: data.id,
    author_type: "client",
    author_profile_id: identity.profileId,
    message_kind: "request",
    body: input.description,
  });
  await db().from("delivery_drafts").update({ current_step: "parcel" }).eq("id", draft.id);
  return evaluationById(data.id);
}

export async function cancelParcelEvaluation(identity: SupportIdentity, id: string) {
  const evaluation = await evaluationById(id);
  if (!evaluation || evaluation.client_profile_id !== identity.profileId) throw new Error("evaluation_not_found");
  if (evaluation.status === "finalized") throw new Error("evaluation_finalized");
  if (evaluation.status === "cancelled") return evaluation;
  const { error } = await db().from("parcel_evaluations").update({
    status: "cancelled",
    cancelled_at: new Date().toISOString(),
  }).eq("id", id).eq("client_profile_id", identity.profileId).not("status", "in", "(finalized,cancelled)");
  if (error) throw new Error(error.message);
  await db().from("parcel_evaluation_messages").insert({
    evaluation_id: id,
    author_type: "system",
    message_kind: "system",
    body: "Clientul a închis cererea de evaluare.",
  });
  return evaluationById(id);
}

export async function answerParcelEvaluation(identity: SupportIdentity, id: string, input: {
  body: string;
  replyToMessageId: string;
}) {
  const evaluation = await evaluationById(id);
  if (!evaluation || evaluation.client_profile_id !== identity.profileId) throw new Error("evaluation_not_found");
  if (evaluation.status !== "waiting_customer") throw new Error("evaluation_not_waiting");
  const messages = Array.isArray(evaluation.parcel_evaluation_messages) ? evaluation.parcel_evaluation_messages : [];
  const question = messages.find((message: any) => message.id === input.replyToMessageId && message.message_kind === "question");
  const alreadyAnswered = messages.some((message: any) => message.reply_to_message_id === input.replyToMessageId && message.message_kind === "answer");
  if (!question || alreadyAnswered) throw new Error("question_not_active");
  const { data, error } = await db().from("parcel_evaluation_messages").insert({
    evaluation_id: id,
    author_type: "client",
    author_profile_id: identity.profileId,
    message_kind: "answer",
    reply_to_message_id: input.replyToMessageId,
    body: input.body,
  }).select("id,created_at").single();
  if (error) throw new Error(error.message);
  await db().from("parcel_evaluations").update({ status: "customer_replied" }).eq("id", id).eq("status", "waiting_customer");
  return data;
}

export async function listParcelEvaluations(identity: SupportIdentity, status?: string | null) {
  requireStaff(identity);
  let query = db().from("parcel_evaluations").select(evaluationSelect)
    .order("updated_at", { ascending: false }).limit(100);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

function ensureEvaluationOwnership(identity: SupportIdentity, evaluation: any) {
  if (!evaluation.assigned_operator_profile_id) return;
  if (evaluation.assigned_operator_profile_id !== identity.profileId && !isSupportAdmin(identity)) {
    throw new Error("evaluation_read_only");
  }
}

async function claimEvaluation(identity: SupportIdentity, evaluation: any) {
  ensureEvaluationOwnership(identity, evaluation);
  if (evaluation.assigned_operator_profile_id) return evaluation;
  const { data, error } = await db().from("parcel_evaluations").update({
    assigned_operator_profile_id: identity.profileId,
    assigned_at: new Date().toISOString(),
    status: evaluation.status === "requested" ? "in_review" : evaluation.status,
  }).eq("id", evaluation.id).is("assigned_operator_profile_id", null).select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("evaluation_already_claimed");
  return data;
}

export async function addParcelEvaluationQuestion(identity: SupportIdentity, id: string, body: string) {
  requireStaff(identity);
  const evaluation = await evaluationById(id);
  if (!evaluation) throw new Error("evaluation_not_found");
  if (["finalized", "cancelled"].includes(evaluation.status)) throw new Error("evaluation_closed");
  await claimEvaluation(identity, evaluation);
  const messages = Array.isArray(evaluation.parcel_evaluation_messages) ? evaluation.parcel_evaluation_messages : [];
  const pendingQuestion = messages.some((message: any) => message.message_kind === "question"
    && !messages.some((candidate: any) => candidate.message_kind === "answer" && candidate.reply_to_message_id === message.id));
  if (pendingQuestion) throw new Error("active_question_exists");
  const { data, error } = await db().from("parcel_evaluation_messages").insert({
    evaluation_id: id,
    author_type: identity.role === "admin" ? "admin" : "operator",
    author_profile_id: identity.profileId,
    message_kind: "question",
    body,
  }).select("id,created_at").single();
  if (error) throw new Error(error.message);
  await db().from("parcel_evaluations").update({ status: "waiting_customer" }).eq("id", id);
  return data;
}

export async function finalizeParcelEvaluation(identity: SupportIdentity, id: string, input: {
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  warnings: string[];
}) {
  requireStaff(identity);
  const evaluation = await evaluationById(id);
  if (!evaluation) throw new Error("evaluation_not_found");
  if (["finalized", "cancelled"].includes(evaluation.status)) throw new Error("evaluation_closed");
  await claimEvaluation(identity, evaluation);
  const now = new Date().toISOString();
  const { data, error } = await db().from("parcel_evaluations").update({
    status: "finalized",
    weight_kg: input.weightKg,
    length_cm: input.lengthCm,
    width_cm: input.widthCm,
    height_cm: input.heightCm,
    warnings: input.warnings,
    finalized_at: now,
  }).eq("id", id).not("status", "in", "(finalized,cancelled)").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("evaluation_changed");

  const draft = Array.isArray(evaluation.delivery_drafts)
    ? evaluation.delivery_drafts[0]
    : evaluation.delivery_drafts;
  const payload = draft?.payload && typeof draft.payload === "object" && !Array.isArray(draft.payload)
    ? draft.payload as Record<string, unknown>
    : {};
  const currentParcel = payload.parcelDraft && typeof payload.parcelDraft === "object" && !Array.isArray(payload.parcelDraft)
    ? payload.parcelDraft as CreateDeliveryParcelDraft
    : undefined;
  const snapshot = evaluation.parcel_snapshot as Partial<ParcelAssistantInput>;
  const fragile = input.warnings.includes("fragile") ? "high" : (snapshot.fragilityLevel ?? currentParcel?.fragilityLevel ?? "moderate");
  const operatorInput = {
    contents: evaluation.initial_description,
    category: snapshot.category ?? currentParcel?.category,
    packaging: snapshot.packaging ?? currentParcel?.packaging,
    approximateSize: snapshot.approximateSize ?? currentParcel?.approximateSize,
    fragilityLevel: fragile,
  } as ParcelAssistantInput;
  const operatorResult: ParcelAssistantResult = {
    estimatedWeightRange: `${input.weightKg.toFixed(1)} kg`,
    estimatedWeightKg: input.weightKg,
    suggestedDimensionsCm: {
      lengthCm: input.lengthCm,
      widthCm: input.widthCm,
      heightCm: input.heightCm,
    },
    fragileLevel: fragile,
    suggestedDroneClass: currentParcel?.recommendedDroneClass ?? "medium_standard",
    clarificationQuestions: [],
    confidenceNote: "Profil confirmat de operatorul SkySend.",
  };
  await db().from("delivery_drafts").update({
    current_step: "parcel",
    payload: {
      ...payload,
      parcelDraft: fromParcelAssistantInput(operatorInput, operatorResult, currentParcel),
    },
  }).eq("id", evaluation.delivery_draft_id).eq("status", "active");

  await db().from("parcel_evaluation_messages").insert({
    evaluation_id: id,
    author_type: "system",
    message_kind: "system",
    body: `Evaluare finalizată: ${input.weightKg} kg, ${input.lengthCm} × ${input.widthCm} × ${input.heightCm} cm.`,
  });
  await db().from("notifications").insert({
    profile_id: evaluation.client_profile_id,
    title: "Evaluarea coletului este gata",
    message: "Greutatea și dimensiunile au fost completate de operator. Poți continua livrarea.",
    type: "system",
    action_url: "/client/create-delivery",
    metadata: { evaluationId: id, draftId: evaluation.delivery_draft_id },
  });
  return evaluationById(id);
}

export async function releaseParcelEvaluation(identity: SupportIdentity, id: string) {
  requireStaff(identity);
  const evaluation = await evaluationById(id);
  if (!evaluation) throw new Error("evaluation_not_found");
  ensureEvaluationOwnership(identity, evaluation);
  const { error } = await db().from("parcel_evaluations").update({
    assigned_operator_profile_id: null,
    assigned_at: null,
    status: evaluation.status === "in_review" ? "requested" : evaluation.status,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  return evaluationById(id);
}
