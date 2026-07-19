import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Resend, type EmailReceivedEvent } from "resend";
import { serverEnv } from "@/lib/env.server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  createR2ObjectKey,
  isAcceptedEmailAttachment,
  uploadR2Object,
} from "@/lib/storage/r2";
import {
  isAuthorizedSupportOperator,
  type SupportIdentity,
} from "@/lib/support/support-hub";

const db = () => createAdminSupabaseClient() as never as {
  from: (table: string) => any;
};

let resendClient: Resend | null = null;

function getResend() {
  if (!serverEnv.RESEND_API_KEY) throw new Error("resend_not_configured");
  resendClient ??= new Resend(serverEnv.RESEND_API_KEY);
  return resendClient;
}

function requireStaff(identity: SupportIdentity) {
  if (!isAuthorizedSupportOperator(identity)) throw new Error("forbidden");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function createSiteMessage(input: {
  email: string;
  name?: string;
  subject: string;
  category?: string | null;
  message: string;
}) {
  const now = new Date().toISOString();
  const { data, error } = await db().from("contact_messages").insert({
    sender_email: input.email,
    sender_name: input.name?.trim() || null,
    subject: input.subject,
    category: input.category ?? null,
    body: input.message,
    status: "new",
    last_message_at: now,
  }).select("id,status,created_at").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function listSiteMessages(identity: SupportIdentity, status?: string | null) {
  requireStaff(identity);
  let query = db().from("contact_messages")
    .select("id,sender_email,sender_name,subject,body,category,status,read_at,last_message_at,replied_at,created_at,updated_at")
    .order("last_message_at", { ascending: false })
    .limit(100);
  if (status && status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getSiteMessage(identity: SupportIdentity, id: string, markRead = true) {
  requireStaff(identity);
  const { data, error } = await db().from("contact_messages")
    .select("id,sender_email,sender_name,subject,body,category,status,read_at,last_message_at,replied_at,created_at,updated_at,contact_message_emails(id,direction,sender_email,recipient_email,subject,body_text,body_html,sent_by_profile_id,resend_email_id,delivery_status,created_at,file_attachments(id,original_name,content_type,size_bytes))")
    .eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("message_not_found");
  if (markRead && data.status === "new") {
    const now = new Date().toISOString();
    await db().from("contact_messages").update({ status: "read", read_at: now }).eq("id", id).eq("status", "new");
    data.status = "read";
    data.read_at = now;
  }
  return data;
}

export async function setSiteMessageArchived(identity: SupportIdentity, id: string, archived: boolean) {
  requireStaff(identity);
  const { data, error } = await db().from("contact_messages").update({
    status: archived ? "archived" : "read",
    closed_at: archived ? new Date().toISOString() : null,
  }).eq("id", id).select("id,status").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("message_not_found");
  return data;
}

export async function replyToSiteMessage(identity: SupportIdentity, id: string, body: string) {
  requireStaff(identity);
  const message = await getSiteMessage(identity, id, false);
  if (message.status === "archived") throw new Error("message_archived");

  const replyTo = `ticket-${id}@${serverEnv.RESEND_INBOUND_DOMAIN}`;
  const subject = /^re:/iu.test(message.subject) ? message.subject : `Re: ${message.subject}`;
  const result = await getResend().emails.send({
    from: serverEnv.RESEND_FROM_EMAIL,
    to: message.sender_email,
    replyTo,
    subject,
    text: body,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6">${escapeHtml(body).replace(/\n/gu, "<br>")}</div>`,
  }, { idempotencyKey: `site-message-${id}-${crypto.randomUUID()}` });
  if (result.error || !result.data?.id) throw new Error(result.error?.message ?? "email_send_failed");

  const now = new Date().toISOString();
  const { data: email, error } = await db().from("contact_message_emails").insert({
    contact_message_id: id,
    direction: "outbound",
    sender_email: serverEnv.RESEND_FROM_EMAIL,
    recipient_email: message.sender_email,
    subject,
    body_text: body,
    sent_by_profile_id: identity.profileId,
    resend_email_id: result.data.id,
    delivery_status: "sent",
  }).select("*").single();
  if (error) throw new Error(error.message);
  await db().from("contact_messages").update({
    status: "replied",
    replied_at: now,
    last_message_at: now,
  }).eq("id", id);
  return email;
}

function ticketIdFromRecipients(recipients: string[]) {
  const domain = serverEnv.RESEND_INBOUND_DOMAIN.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(`ticket-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})@${domain}`, "iu");
  for (const recipient of recipients) {
    const match = recipient.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function verifyResendWebhook(payload: string, headers: Headers) {
  if (!serverEnv.RESEND_WEBHOOK_SECRET) throw new Error("resend_webhook_not_configured");
  return getResend().webhooks.verify({
    payload,
    webhookSecret: serverEnv.RESEND_WEBHOOK_SECRET,
    headers: {
      id: headers.get("svix-id") ?? "",
      timestamp: headers.get("svix-timestamp") ?? "",
      signature: headers.get("svix-signature") ?? "",
    },
  });
}

export async function ingestResendInbound(event: EmailReceivedEvent) {
  const ticketId = ticketIdFromRecipients([...event.data.to, ...(event.data.received_for ?? [])]);
  if (!ticketId) return { ignored: true, reason: "unknown_recipient" } as const;
  const { data: message, error: messageError } = await db().from("contact_messages")
    .select("id,status")
    .eq("id", ticketId).maybeSingle();
  if (messageError) throw new Error(messageError.message);
  if (!message) return { ignored: true, reason: "thread_not_found" } as const;

  const received = await getResend().emails.receiving.get(event.data.email_id, { html_format: "cid" });
  if (received.error || !received.data) throw new Error(received.error?.message ?? "inbound_fetch_failed");
  const { data: existing } = await db().from("contact_message_emails")
    .select("id").eq("resend_email_id", event.data.email_id).maybeSingle();
  let emailId = existing?.id as string | undefined;

  if (!emailId) {
    const { data: email, error: emailError } = await db().from("contact_message_emails").insert({
    contact_message_id: ticketId,
    direction: "inbound",
    sender_email: received.data.from,
    recipient_email: received.data.to[0] ?? `ticket-${ticketId}@${serverEnv.RESEND_INBOUND_DOMAIN}`,
    subject: received.data.subject || "Fără subiect",
    body_text: received.data.text,
    body_html: received.data.html,
    resend_email_id: event.data.email_id,
    internet_message_id: received.data.message_id,
    in_reply_to: received.data.headers?.["in-reply-to"] ?? null,
    delivery_status: "received",
    created_at: received.data.created_at,
    }).select("id").single();
    if (emailError) throw new Error(emailError.message);
    emailId = email.id;
  }

  const attachments = (received.data.attachments ?? []).slice(0, 10);
  for (const attachment of attachments) {
    if (!isAcceptedEmailAttachment(attachment.content_type, attachment.size)) continue;
    const { data: stored } = await db().from("file_attachments")
      .select("id")
      .eq("contact_email_id", emailId)
      .eq("original_name", attachment.filename ?? "attachment")
      .eq("content_type", attachment.content_type)
      .eq("size_bytes", attachment.size)
      .maybeSingle();
    if (stored) continue;
    const download = await getResend().emails.receiving.attachments.get({
      emailId: event.data.email_id,
      id: attachment.id,
    });
    if (download.error || !download.data?.download_url) continue;
    const response = await fetch(download.data.download_url);
    if (!response.ok) continue;
    const body = new Uint8Array(await response.arrayBuffer());
    if (!isAcceptedEmailAttachment(attachment.content_type, body.byteLength)) continue;
    const objectKey = createR2ObjectKey("email", ticketId, attachment.filename ?? "attachment");
    await uploadR2Object({ objectKey, body, contentType: attachment.content_type });
    const { error: attachmentError } = await db().from("file_attachments").insert({
      contact_email_id: emailId,
      r2_object_key: objectKey,
      original_name: attachment.filename ?? "attachment",
      content_type: attachment.content_type,
      size_bytes: body.byteLength,
    });
    if (attachmentError) throw new Error(attachmentError.message);
  }

  const now = new Date().toISOString();
  await db().from("contact_messages").update({
    status: "new",
    read_at: null,
    last_message_at: now,
  }).eq("id", ticketId);
  return { ignored: false, duplicate: Boolean(existing), id: ticketId } as const;
}
