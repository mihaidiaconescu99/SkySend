import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  createR2DownloadUrl,
  createR2ObjectKey,
  createR2UploadUrl,
  isSupportImage,
} from "@/lib/storage/r2";
import {
  isAuthorizedSupportOperator,
  isSupportAdmin,
  type SupportIdentity,
} from "@/lib/support/support-hub";

type AttachmentScope = "support" | "evaluation";

const db = () => createAdminSupabaseClient() as never as {
  from: (table: string) => any;
};

async function authorizeParent(identity: SupportIdentity, scope: AttachmentScope, parentId: string) {
  const staff = isAuthorizedSupportOperator(identity);
  if (scope === "support") {
    const { data, error } = await db().from("assistant_messages")
      .select("id,author_profile_id,assistant_conversations(profile_id,support_tickets(status,assigned_operator_profile_id))")
      .eq("id", parentId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("message_not_found");
    const ticket = Array.isArray(data.assistant_conversations?.support_tickets)
      ? data.assistant_conversations.support_tickets[0]
      : data.assistant_conversations?.support_tickets;
    if (!ticket || ticket.status === "closed") throw new Error("ticket_closed");
    if (!staff && data.assistant_conversations?.profile_id !== identity.profileId) throw new Error("forbidden");
    if (staff && ticket.assigned_operator_profile_id !== identity.profileId && !isSupportAdmin(identity)) throw new Error("ticket_read_only");
    return { column: "assistant_message_id" as const };
  }

  const { data, error } = await db().from("parcel_evaluation_messages")
    .select("id,author_profile_id,parcel_evaluations(client_profile_id,assigned_operator_profile_id,status)")
    .eq("id", parentId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("message_not_found");
  const evaluation = data.parcel_evaluations;
  if (!evaluation || ["finalized", "cancelled"].includes(evaluation.status)) throw new Error("evaluation_closed");
  if (!staff && evaluation.client_profile_id !== identity.profileId) throw new Error("forbidden");
  if (staff && evaluation.assigned_operator_profile_id !== identity.profileId && !isSupportAdmin(identity)) throw new Error("evaluation_read_only");
  return { column: "evaluation_message_id" as const };
}

export async function createAttachmentUpload(identity: SupportIdentity, input: {
  scope: AttachmentScope;
  parentId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  await authorizeParent(identity, input.scope, input.parentId);
  if (!isSupportImage(input.contentType, input.sizeBytes)) throw new Error("invalid_image");
  const column = input.scope === "support" ? "assistant_message_id" : "evaluation_message_id";
  const { count, error } = await db().from("file_attachments")
    .select("id", { count: "exact", head: true }).eq(column, input.parentId);
  if (error) throw new Error(error.message);
  if ((count ?? 0) >= 2) throw new Error("attachment_limit");
  const objectKey = createR2ObjectKey(input.scope, identity.profileId, input.fileName);
  const uploadUrl = await createR2UploadUrl({
    objectKey,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
  });
  return { objectKey, uploadUrl };
}

export async function completeAttachmentUpload(identity: SupportIdentity, input: {
  scope: AttachmentScope;
  parentId: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}) {
  const parent = await authorizeParent(identity, input.scope, input.parentId);
  if (!isSupportImage(input.contentType, input.sizeBytes)) throw new Error("invalid_image");
  const expectedPrefix = `${input.scope}/${identity.profileId}/`;
  if (!input.objectKey.startsWith(expectedPrefix)) throw new Error("invalid_object_key");
  const { count, error: countError } = await db().from("file_attachments")
    .select("id", { count: "exact", head: true }).eq(parent.column, input.parentId);
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= 2) throw new Error("attachment_limit");
  const { data, error } = await db().from("file_attachments").insert({
    [parent.column]: input.parentId,
    uploaded_by_profile_id: identity.profileId,
    r2_object_key: input.objectKey,
    original_name: input.fileName,
    content_type: input.contentType,
    size_bytes: input.sizeBytes,
  }).select("id,original_name,content_type,size_bytes").single();
  if (error) throw new Error(error.code === "23505" ? "attachment_exists" : error.message);
  return data;
}

export async function getAttachmentDownload(identity: SupportIdentity, id: string) {
  const { data, error } = await db().from("file_attachments")
    .select("id,r2_object_key,uploaded_by_profile_id,assistant_message_id,evaluation_message_id,contact_email_id")
    .eq("id", id).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("attachment_not_found");
  if (data.contact_email_id) {
    if (!isAuthorizedSupportOperator(identity)) throw new Error("forbidden");
  } else if (data.assistant_message_id) {
    const { data: message } = await db().from("assistant_messages")
      .select("assistant_conversations(profile_id,support_tickets(assigned_operator_profile_id))")
      .eq("id", data.assistant_message_id).maybeSingle();
    const ticket = Array.isArray(message?.assistant_conversations?.support_tickets)
      ? message.assistant_conversations.support_tickets[0]
      : message?.assistant_conversations?.support_tickets;
    if (
      isAuthorizedSupportOperator(identity)
        ? !isSupportAdmin(identity) &&
          ticket?.assigned_operator_profile_id !== identity.profileId
        : message?.assistant_conversations?.profile_id !== identity.profileId
    ) {
      throw new Error("forbidden");
    }
  } else if (data.evaluation_message_id) {
    const { data: message } = await db().from("parcel_evaluation_messages")
      .select("parcel_evaluations(client_profile_id,assigned_operator_profile_id)")
      .eq("id", data.evaluation_message_id).maybeSingle();
    if (
      isAuthorizedSupportOperator(identity)
        ? !isSupportAdmin(identity) &&
          message?.parcel_evaluations?.assigned_operator_profile_id !==
            identity.profileId
        : message?.parcel_evaluations?.client_profile_id !== identity.profileId
    ) {
      throw new Error("forbidden");
    }
  }
  return createR2DownloadUrl(data.r2_object_key);
}
