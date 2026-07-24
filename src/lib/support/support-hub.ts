import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  localOrderIdSchema,
  normalizedEmailSchema,
  plainTextSchema,
} from "@/lib/api/input-schemas";
import { sendSupportEmail } from "@/lib/email/support-email";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { getServerAuthorizationContext } from "@/lib/server-authorization";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/roles";

export const supportCategories = ["parcel_data", "delivery_tracking", "billing", "account", "technical", "general"] as const;
export const supportStatuses = ["open", "assigned", "waiting_customer", "closed"] as const;
export type SupportCategory = (typeof supportCategories)[number];
export type SupportStatus = (typeof supportStatuses)[number];
export type SupportActor = "client" | "assistant" | "operator" | "system";

export type SupportIdentity = {
  clerkUserId: string;
  profileId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  role: UserRole;
};

const db = () => createAdminSupabaseClient() as never as {
  from: (table: string) => any;
};

export async function getSupportIdentity(clerkUserId: string): Promise<SupportIdentity | null> {
  const authorization = await getServerAuthorizationContext();
  if (
    authorization.userId !== clerkUserId ||
    authorization.resolution !== "resolved" ||
    !authorization.role
  ) {
    return null;
  }
  const user = await currentUser();
  if (!user || user.id !== clerkUserId) return null;
  const supabase = createAdminSupabaseClient();
  const profiles = new ProfilesRepository(supabase);
  const email = user?.emailAddresses.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress
    ?? user?.emailAddresses[0]?.emailAddress
    ?? null;
  const fullName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || null;
  const avatarUrl = user?.imageUrl || null;
  const role = authorization.role;
  const profile = await profiles.findOrCreateByClerkUserId(clerkUserId, {
    clerkUserId,
    email: email ?? `${clerkUserId}@skysend.local`,
    fullName,
    role,
  });
  if (!profile.ok || !profile.data) return null;

  if (profile.data.role !== role) {
    await profiles.updateById(profile.data.id, { role });
  }
  await db().from("profiles").update({ avatar_url: avatarUrl }).eq("id", profile.data.id);

  return {
    clerkUserId,
    profileId: profile.data.id,
    email: email ?? profile.data.email ?? null,
    name: fullName ?? profile.data.fullName,
    avatarUrl,
    role,
  };
}

export function isSupportOperator(role: UserRole | null | undefined) {
  return role === "operator" || role === "admin";
}

export function isAuthorizedSupportOperator(identity: SupportIdentity | null | undefined) {
  if (!identity) return false;
  return isSupportOperator(identity.role);
}

export function isSupportAdmin(identity: SupportIdentity | null | undefined) {
  return identity?.role === "admin";
}

export function priorityForSupportText(text: string): "normal" | "high" | "urgent" {
  const value = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("ro-RO");
  if (/(locker|recuperare|blocat|blocata|blocaj)/u.test(value)) return "urgent";
  if (/(plata esuata|plata respinsa|payment failed|card respins)/u.test(value)) return "high";
  return "normal";
}

export function categoryFromContact(value: string | null | undefined): SupportCategory {
  const normalized = value?.toLocaleLowerCase("ro-RO") ?? "";
  if (/(colet|parcel)/u.test(normalized)) return "parcel_data";
  if (/(livrare|tracking|urm)/u.test(normalized)) return "delivery_tracking";
  if (/(plat|factur)/u.test(normalized)) return "billing";
  if (/(cont|profil)/u.test(normalized)) return "account";
  if (/(tehn|bug|eroare)/u.test(normalized)) return "technical";
  return "general";
}

function titleFromMessage(message: string) {
  const clean = message.replace(/\s+/gu, " ").trim();
  return clean.slice(0, 84) || "Solicitare de suport";
}

export function sanitizeSupportSummaryText(value: string) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, "[email eliminat]")
    .replace(/(?:\+?40|0)[\s.-]?[1-9](?:[\s.-]?\d){7,8}/gu, "[telefon eliminat]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/gu, "[număr de card eliminat]")
    .replace(/\b(?:pi|ch|tok|sk|rk)_[A-Za-z0-9_-]+\b/gu, "[identificator eliminat]")
    .replace(/\b[0-9a-f]{32,}\b/giu, "[token eliminat]")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 700);
}

async function audit(actor: SupportIdentity | null, action: string, entityId: string, changes: Record<string, unknown> = {}) {
  await db().from("audit_events").insert({
    actor_profile_id: actor?.profileId ?? null,
    actor_role: actor?.role ?? "system",
    action,
    entity_type: "support_ticket",
    entity_id: entityId,
    changes,
  });
}

async function notifyClient(profileId: string | null, email: string | null, title: string, message: string, ticketId: string) {
  if (profileId) {
    await db().from("notifications").insert({
      profile_id: profileId,
      title,
      message,
      type: "system",
      action_url: "/client/support",
      metadata: { ticketId },
    });
  }
  await sendSupportEmail({ to: email, title, message, ticketId });
}

export async function purgeExpiredSupportConversations() {
  await db().from("assistant_conversations").delete().lt("expires_at", new Date().toISOString());
}

export async function listConversations(identity: SupportIdentity) {
  await purgeExpiredSupportConversations();
  const { data, error } = await db().from("assistant_conversations")
    .select("id,title,mode,last_message_at,created_at,support_tickets(id,status,assigned_operator_profile_id,priority)")
    .eq("profile_id", identity.profileId).gt("expires_at", new Date().toISOString())
    .order("last_message_at", { ascending: false }).limit(30);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getConversation(identity: SupportIdentity, conversationId: string) {
  const query = db().from("assistant_conversations")
    .select("id,profile_id,contact_email,contact_name,title,mode,last_message_at,expires_at,created_at,client_profile:profile_id(id,full_name,email,avatar_url),support_tickets(id,source,subject,category,priority,status,assigned_operator_profile_id,client_profile_id,ai_summary,linked_order_id,assigned_operator:assigned_operator_profile_id(id,full_name,email,avatar_url)),assistant_messages(id,author_type,author_profile_id,body,created_at,author_profile:author_profile_id(id,full_name,email,avatar_url),file_attachments(id,original_name,content_type,size_bytes))")
    .eq("id", conversationId).gt("expires_at", new Date().toISOString());
  if (!isAuthorizedSupportOperator(identity)) query.eq("profile_id", identity.profileId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createConversation(identity: SupportIdentity) {
  await purgeExpiredSupportConversations();
  const { data, error } = await db().from("assistant_conversations").insert({
    profile_id: identity.profileId, contact_email: null, contact_name: null,
  }).select("id,title,mode,last_message_at,created_at").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function persistAiExchange(identity: SupportIdentity, message: string, reply: string, conversationId?: string | null) {
  const conversation = conversationId ? await getConversation(identity, conversationId) : await createConversation(identity);
  if (!conversation) throw new Error("conversation_not_found");
  if (conversation.mode !== "ai_active") throw new Error("human_support_active");
  const client = await db().from("assistant_messages").insert({
    conversation_id: conversation.id, author_type: "client", author_profile_id: identity.profileId, body: message,
  });
  if (client.error) throw new Error(client.error.message);
  const assistant = await db().from("assistant_messages").insert({
    conversation_id: conversation.id, author_type: "assistant", body: reply,
  });
  if (assistant.error) throw new Error(assistant.error.message);
  await db().from("assistant_conversations").update({
    title: titleFromMessage(message), last_message_at: new Date().toISOString(),
  }).eq("id", conversation.id);
  return conversation.id as string;
}

export async function handoffConversation(identity: SupportIdentity, conversationId: string) {
  const conversation = await getConversation(identity, conversationId);
  if (!conversation || conversation.profile_id !== identity.profileId) throw new Error("conversation_not_found");
  const currentTicket = Array.isArray(conversation.support_tickets) ? conversation.support_tickets[0] : conversation.support_tickets;
  if (currentTicket?.id) return currentTicket;
  const history = Array.isArray(conversation.assistant_messages) ? conversation.assistant_messages : [];
  const clientMessages = history
    .filter((item: any) => item.author_type === "client")
    .sort((left: any, right: any) => String(left.created_at).localeCompare(String(right.created_at)))
    .map((item: any) => sanitizeSupportSummaryText(String(item.body ?? "")))
    .filter(Boolean);
  const clientText = clientMessages.join("\n");
  const subject = titleFromMessage(clientText || conversation.title);
  const category = categoryFromContact(clientText);
  const localOrderId = clientText.match(/SKY-[A-Z]{2}-\d{5}-\d{3}/iu)?.[0] ?? null;
  let linkedOrderId: string | null = null;
  let orderContext = "Nicio comandă proprie identificată.";
  if (localOrderId) {
    const { data: order, error: orderError } = await db().from("orders")
      .select("id,local_order_id,status,fulfillment_status,payment_status,refund_status")
      .eq("local_order_id", localOrderId)
      .eq("sender_profile_id", identity.profileId)
      .maybeSingle();
    if (orderError) throw new Error(orderError.message);
    if (order) {
      linkedOrderId = order.id;
      orderContext = `Comandă proprie verificată: ${order.local_order_id}; status ${order.status}; misiune ${order.fulfillment_status ?? "nespecificată"}; plată ${order.payment_status}; rambursare ${order.refund_status ?? "fără status"}.`;
    }
  }
  const summary = [
    `Problemă: ${clientMessages.at(-1) ?? subject}`,
    `Pași sau context deja menționat: ${clientMessages.slice(-4, -1).join(" | ") || "niciun pas menționat"}.`,
    orderContext,
  ].join("\n").slice(0, 1_500);
  const { data: ticket, error } = await db().from("support_tickets").insert({
    conversation_id: conversationId, source: "ai_handoff", client_profile_id: identity.profileId,
    linked_order_id: linkedOrderId,
    subject, category, priority: priorityForSupportText(clientText), status: "open",
    ai_summary: summary,
  }).select("*").single();
  if (error) throw new Error(error.message);
  await db().from("assistant_conversations").update({ mode: "human_requested", last_message_at: new Date().toISOString() }).eq("id", conversationId);
  await db().from("assistant_messages").insert({ conversation_id: conversationId, author_type: "system", body: "Solicitarea a fost trimisă către un operator SkySend." });
  await audit(identity, "support_ticket_created_from_ai", ticket.id, { conversationId });
  await notifyClient(identity.profileId, identity.email, "Solicitarea ta a ajuns la suport", "Un operator SkySend va prelua conversația. Poți reveni aici pentru răspuns.", ticket.id);
  return ticket;
}

export const directSupportTicketSchema = z.object({
  subject: plainTextSchema(3, 160),
  category: z.enum(supportCategories),
  message: plainTextSchema(10, 5000),
  orderId: localOrderIdSchema.optional(),
}).strict();

export async function createDirectSupportTicket(
  identity: SupportIdentity,
  input: z.infer<typeof directSupportTicketSchema>,
) {
  const parsed = directSupportTicketSchema.parse(input);
  let linkedOrderId: string | null = null;
  if (parsed.orderId) {
    const { data: order, error } = await db().from("orders")
      .select("id")
      .eq("local_order_id", parsed.orderId)
      .eq("sender_profile_id", identity.profileId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!order) throw new Error("order_not_found");
    linkedOrderId = order.id;
  }

  const { data: conversation, error: conversationError } = await db()
    .from("assistant_conversations")
    .insert({
      profile_id: identity.profileId,
      title: parsed.subject,
      mode: "human_requested",
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (conversationError) throw new Error(conversationError.message);

  try {
    const { data: message, error: messageError } = await db()
      .from("assistant_messages")
      .insert({
        conversation_id: conversation.id,
        author_type: "client",
        author_profile_id: identity.profileId,
        body: parsed.message,
      })
      .select("id")
      .single();
    if (messageError) throw new Error(messageError.message);

    const { data: ticket, error: ticketError } = await db()
      .from("support_tickets")
      .insert({
        conversation_id: conversation.id,
        source: "direct",
        client_profile_id: identity.profileId,
        linked_order_id: linkedOrderId,
        subject: parsed.subject,
        category: parsed.category,
        priority: priorityForSupportText(`${parsed.subject}\n${parsed.message}`),
        status: "open",
      })
      .select("*")
      .single();
    if (ticketError) throw new Error(ticketError.message);

    await db().from("assistant_messages").insert({
      conversation_id: conversation.id,
      author_type: "system",
      body: "Solicitarea a fost trimisă direct către un operator SkySend.",
    });
    await audit(identity, "support_ticket_created_directly", ticket.id, {
      conversationId: conversation.id,
      linkedOrderId,
    });
    await notifyClient(
      identity.profileId,
      identity.email,
      "Solicitarea ta a ajuns la suport",
      "Un operator SkySend va prelua conversația. Poți reveni aici pentru răspuns.",
      ticket.id,
    );
    return { ticket, conversationId: conversation.id as string, messageId: message.id as string };
  } catch (error) {
    await db().from("assistant_conversations").delete().eq("id", conversation.id);
    throw error;
  }
}

export const publicContactSchema = z.object({
  email: normalizedEmailSchema,
  subject: plainTextSchema(1, 200),
  category: plainTextSchema(1, 80).nullable().optional(),
  message: plainTextSchema(1, 5000),
  name: plainTextSchema(1, 120).optional(),
}).strict();

export async function listTickets(identity: SupportIdentity, queue: string) {
  if (!isAuthorizedSupportOperator(identity)) throw new Error("forbidden");
  let query = db().from("support_tickets")
    .select("id,conversation_id,source,subject,category,priority,status,assigned_operator_profile_id,client_profile_id,linked_order_id,created_at,updated_at,assigned_at,assistant_conversations(contact_email,contact_name,title),client_profile:client_profile_id(id,full_name,email,avatar_url),assigned_operator:assigned_operator_profile_id(id,full_name,email,avatar_url)")
    .order("updated_at", { ascending: false }).limit(100);
  if (queue === "claimed") query = query.not("assigned_operator_profile_id", "is", null).eq("status", "assigned");
  else if (queue === "waiting_customer") query = query.eq("status", "waiting_customer");
  else if (queue === "closed") query = query.eq("status", "closed");
  else query = query.is("assigned_operator_profile_id", null).neq("status", "closed");
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getTicketCounts(identity: SupportIdentity) {
  if (!isAuthorizedSupportOperator(identity)) throw new Error("forbidden");
  const queues = ["unassigned", "claimed", "waiting_customer", "closed"] as const;
  const values = await Promise.all(queues.map(async (queue) => [queue, (await listTickets(identity, queue)).length] as const));
  return Object.fromEntries(values);
}

export async function updateTicket(identity: SupportIdentity, ticketId: string, action: "claim" | "release" | "close") {
  if (!isAuthorizedSupportOperator(identity)) throw new Error("forbidden");
  const { data: current, error: currentError } = await db().from("support_tickets")
    .select("id,status,assigned_operator_profile_id,client_profile_id,conversation_id,assistant_conversations(contact_email),client_profile:client_profile_id(email)")
    .eq("id", ticketId).maybeSingle();
  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("ticket_not_found");
  if (current.status === "closed") throw new Error("ticket_closed");

  const now = new Date().toISOString();
  let payload: Record<string, unknown>;
  let query = db().from("support_tickets").update({});

  if (action === "claim") {
    if (current.assigned_operator_profile_id === identity.profileId) return current;
    if (current.assigned_operator_profile_id) throw new Error("ticket_already_claimed");
    payload = { assigned_operator_profile_id: identity.profileId, assigned_at: now, status: "assigned" };
    query = db().from("support_tickets").update(payload).eq("id", ticketId).is("assigned_operator_profile_id", null);
  } else if (action === "release") {
    if (current.assigned_operator_profile_id !== identity.profileId && !isSupportAdmin(identity)) throw new Error("ticket_not_owned");
    payload = { assigned_operator_profile_id: null, assigned_at: null, status: "open" };
    query = db().from("support_tickets").update(payload).eq("id", ticketId).eq("assigned_operator_profile_id", current.assigned_operator_profile_id);
  } else {
    if (!current.assigned_operator_profile_id) throw new Error("ticket_not_claimed");
    if (current.assigned_operator_profile_id !== identity.profileId && !isSupportAdmin(identity)) throw new Error("ticket_not_owned");
    payload = { status: "closed", closed_at: now, closed_by_profile_id: identity.profileId };
    query = db().from("support_tickets").update(payload).eq("id", ticketId).neq("status", "closed");
  }

  const { data, error } = await query.select("*").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("ticket_changed");
  if (action === "close") {
    await db().from("assistant_conversations").update({ mode: "closed", last_message_at: now }).eq("id", current.conversation_id);
  }
  await audit(identity, `support_ticket_${action}`, ticketId, payload);
  if (action === "close") {
    await notifyClient(
      current.client_profile_id,
      current.client_profile?.email ?? current.assistant_conversations?.contact_email ?? null,
      "Solicitare SkySend închisă",
      "Operatorul a marcat solicitarea ca rezolvată. Conversația rămâne disponibilă în istoric.",
      ticketId,
    );
  }
  return data;
}

export async function addSupportMessage(identity: SupportIdentity, conversationId: string, body: string) {
  const conversation = await getConversation(identity, conversationId);
  if (!conversation) throw new Error("conversation_not_found");
  const staff = isAuthorizedSupportOperator(identity);
  const ticket = Array.isArray(conversation.support_tickets) ? conversation.support_tickets[0] : conversation.support_tickets;
  if (!ticket) throw new Error("ticket_not_found");
  if (ticket.status === "closed" || conversation.mode === "closed") throw new Error("ticket_closed");
  if (staff && !ticket.assigned_operator_profile_id) throw new Error("ticket_not_claimed");
  if (staff && ticket.assigned_operator_profile_id !== identity.profileId && !isSupportAdmin(identity)) throw new Error("ticket_read_only");
  if (!staff && conversation.profile_id !== identity.profileId) throw new Error("forbidden");

  const authorType: SupportActor = staff ? "operator" : "client";
  const { data: message, error } = await db().from("assistant_messages").insert({
    conversation_id: conversationId,
    author_type: authorType,
    author_profile_id: identity.profileId,
    body,
  }).select("id,author_type,author_profile_id,body,created_at").single();
  if (error) throw new Error(error.message);
  const nextStatus: SupportStatus = staff ? "waiting_customer" : (ticket.assigned_operator_profile_id ? "assigned" : "open");
  await db().from("support_tickets").update({ status: nextStatus }).eq("id", ticket.id).neq("status", "closed");
  await db().from("assistant_conversations").update({ mode: "human_active", last_message_at: new Date().toISOString() }).eq("id", conversationId).neq("mode", "closed");
  await audit(identity, staff ? "support_operator_message" : "support_client_message", ticket.id);
  if (staff) await notifyClient(ticket.client_profile_id, conversation.contact_email, "Ai un răspuns de la SkySend", "Un operator ți-a răspuns. Deschide SkySend pentru a continua conversația.", ticket.id);
  return { status: nextStatus, message };
}
