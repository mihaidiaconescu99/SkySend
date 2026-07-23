import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import type Stripe from "stripe";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";
import { rowToOrder } from "@/lib/repositories/mappers/order-mapper";
import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import { ensureOrderMission } from "@/lib/mission-bootstrap-server";
import { ensureOrderCommunication } from "@/lib/order-communications-server";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { ensureInvoiceDocument, getBillingSnapshotForOrder } from "@/lib/billing/server";
import { getOperationalStatusSnapshot } from "@/lib/operational-status-server";

const db = () => createAdminSupabaseClient() as any;

async function findOrderForIntent(paymentIntentId: string, metadataOrderId?: string | null) {
  const database = db();
  const { data, error } = await database.from("orders").select("*")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (
    data &&
    metadataOrderId &&
    metadataOrderId !== data.id &&
    metadataOrderId !== data.local_order_id
  ) {
    throw new Error("webhook_order_metadata_mismatch");
  }
  return data ?? null;
}

async function paymentMethodSnapshot(intent: Stripe.PaymentIntent) {
  const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id;
  if (!chargeId) return { provider: "Stripe" };
  const charge = await getStripeServer().charges.retrieve(chargeId);
  const card = charge.payment_method_details?.card;
  return {
    provider: "Stripe",
    method: charge.payment_method_details?.type ?? "card",
    brand: card?.brand ?? null,
    last4: card?.last4 ?? null,
    chargeId,
  };
}

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent, origin: string) {
  const database = db();
  const row = await findOrderForIntent(intent.id, intent.metadata.orderId);
  if (!row) throw new Error("webhook_order_not_found");
  if (row.stripe_payment_intent_id !== intent.id) {
    throw new Error("webhook_payment_intent_mismatch");
  }
  if (intent.metadata.orderUuid && intent.metadata.orderUuid !== row.id) {
    throw new Error("webhook_order_metadata_mismatch");
  }
  const { data: owner } = await database.from("profiles")
    .select("clerk_user_id").eq("id", row.sender_profile_id).maybeSingle();
  if (!owner || intent.metadata.customerProfileId !== owner.clerk_user_id) {
    throw new Error("webhook_payment_owner_mismatch");
  }
  if (row.total_amount_minor !== intent.amount_received || row.currency.toLowerCase() !== intent.currency.toLowerCase()) {
    throw new Error("webhook_payment_amount_mismatch");
  }
  const snapshot = await getBillingSnapshotForOrder(createAdminSupabaseClient(), row.id);
  if (!snapshot) throw new Error("webhook_billing_snapshot_missing");
  const method = await paymentMethodSnapshot(intent);
  const chargeId = typeof intent.latest_charge === "string" ? intent.latest_charge : intent.latest_charge?.id ?? null;
  const paidAt = new Date((intent.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString();
  const { data: updated, error } = await database.from("orders").update({
    payment_status: "paid",
    stripe_payment_intent_id: intent.id,
    stripe_charge_id: chargeId,
    paid_at: paidAt,
    status: row.status === "pending" ? "in_progress" : row.status,
    fulfillment_status: row.fulfillment_status === "order_created" || !row.fulfillment_status ? "active_mission" : row.fulfillment_status,
  }).eq("id", row.id).select("*").single();
  if (error) throw new Error(error.message);
  await database.from("order_billing_snapshots").update({ locked_at: paidAt }).eq("id", snapshot.id).is("locked_at", null);

  const payments = new PaymentRecordsRepository(createAdminSupabaseClient());
  const existing = await payments.listByOrderId(row.id);
  if (!existing.ok || !existing.data.some((record) => record.type === "payment" && record.stripePaymentIntentId === intent.id)) {
    await payments.create({
      orderId: row.id, profileId: row.sender_profile_id, stripePaymentIntentId: intent.id,
      stripeChargeId: chargeId, amountMinor: intent.amount_received,
      currency: intent.currency.toUpperCase(), type: "payment", status: "succeeded",
    });
  }
  const order = rowToOrder(updated);
  await ensureInvoiceDocument(createAdminSupabaseClient(), order, method);
  const operational = await getOperationalStatusSnapshot();
  const mission = await ensureOrderMission(createAdminSupabaseClient(), order);
  if (
    mission &&
    operational.effectiveStatus !== "active" &&
    ["mission_created", "preflight_checks"].includes(mission.currentStatus)
  ) {
    const remaining = mission.stepExpiresAt
      ? Math.max(0, Math.ceil((Date.parse(mission.stepExpiresAt) - Date.now()) / 1000))
      : null;
    await database.from("missions").update({
      operational_hold_reason: operational.effectiveStatus === "suspended" ? "weather" : "maintenance",
      operational_held_at: new Date().toISOString(),
      operational_hold_remaining_seconds: remaining,
      step_expires_at: null,
    }).eq("id", mission.id);
  }
  const profile = await new ProfilesRepository(createAdminSupabaseClient()).getById(row.sender_profile_id);
  if (profile.ok && profile.data) {
    await ensureOrderCommunication({
      supabase: createAdminSupabaseClient(), order, profile: profile.data,
      locale: snapshot.locale === "en" ? "en" : "ro", origin,
    });
  }
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
  const database = db();
  const row = await findOrderForIntent(intent.id, intent.metadata.orderId);
  if (!row || row.payment_status === "paid") return;
  await database.from("orders").update({ payment_status: "failed", stripe_payment_intent_id: intent.id })
    .eq("id", row.id);
}

async function handleRefund(refund: any) {
  if (refund.status && refund.status !== "succeeded") return;
  const database = db();
  const paymentIntentId = typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id;
  let query = database.from("orders").select("*");
  query = paymentIntentId ? query.eq("stripe_payment_intent_id", paymentIntentId) : query.eq("stripe_charge_id", refund.charge);
  const { data: row } = await query.maybeSingle();
  if (!row) throw new Error("refund_order_not_found");
  const { data: existing } = await database.from("payment_records").select("id").eq("stripe_refund_id", refund.id).maybeSingle();
  if (existing) return;
  const { data: previousRefunds } = await database.from("payment_records")
    .select("amount_minor").eq("order_id", row.id).in("type", ["refund", "partial_refund"]).eq("status", "succeeded");
  const alreadyRefunded = (previousRefunds ?? []).reduce((sum: number, item: any) => sum + Number(item.amount_minor), 0);
  const totalRefunded = alreadyRefunded + Number(refund.amount);
  const full = totalRefunded >= Number(row.total_amount_minor);
  await database.from("payment_records").insert({
    order_id: row.id, profile_id: row.sender_profile_id,
    stripe_payment_intent_id: row.stripe_payment_intent_id,
    stripe_charge_id: row.stripe_charge_id, stripe_refund_id: refund.id,
    amount_minor: refund.amount, currency: String(refund.currency).toUpperCase(),
    type: full ? "refund" : "partial_refund", status: "succeeded",
  });
  await database.from("orders").update({
    payment_status: full ? "refunded" : "partially_refunded",
    refund_status: "completed",
  }).eq("id", row.id);
  await database.from("refund_requests").update({ status: "succeeded" }).eq("stripe_refund_id", refund.id);

  const [{ data: invoice }, { data: snapshot }] = await Promise.all([
    database.from("billing_documents").select("*").eq("order_id", row.id).eq("document_type", "invoice").maybeSingle(),
    database.from("order_billing_snapshots").select("*").eq("order_id", row.id).maybeSingle(),
  ]);
  if (!invoice || !snapshot) return;
  const locale = snapshot.locale === "en" ? "en" : "ro";
  const lineItems = [{
    code: "refund", nameRo: "Rambursare comandă", nameEn: "Order refund", amountMinor: refund.amount,
  }];
  const { error } = await database.rpc("create_billing_document", {
    p_order_id: row.id, p_billing_snapshot_id: snapshot.id,
    p_document_type: "credit_note", p_amount_minor: refund.amount,
    p_currency: String(refund.currency).toUpperCase(), p_line_items: lineItems,
    p_payment_method: invoice.payment_method_snapshot ?? {},
    p_original_document_id: invoice.id, p_stripe_refund_id: refund.id,
    p_refund_kind: full ? "full" : "partial",
    p_refund_reason: refund.metadata?.failureReason ?? refund.reason ?? (locale === "ro" ? "Rambursare" : "Refund"),
  });
  if (error && !String(error.code).includes("23505")) throw new Error(error.message);
}

export async function processStripeEvent(event: Stripe.Event, origin: string) {
  const database = db();
  const object = event.data.object as any;
  let { data: claimed, error } = await database.from("stripe_events").insert({
    event_id: event.id, event_type: event.type, object_id: object?.id ?? null,
  }).select("event_id").maybeSingle();
  if (error?.code === "23505") {
    const { data: previous } = await database.from("stripe_events")
      .select("processing_status").eq("event_id", event.id).maybeSingle();
    if (previous?.processing_status !== "failed") return { duplicate: true };
    const retry = await database.from("stripe_events").update({
      processing_status: "processing", last_error: null,
    }).eq("event_id", event.id).eq("processing_status", "failed")
      .select("event_id").maybeSingle();
    claimed = retry.data;
    error = retry.error;
  }
  if (!claimed) return { duplicate: true };
  if (error) throw new Error(error.message);
  try {
    if (event.type === "payment_intent.succeeded") await handlePaymentSucceeded(object, origin);
    else if (event.type === "payment_intent.payment_failed") await handlePaymentFailed(object);
    else if (event.type === "refund.created" || event.type === "refund.updated") await handleRefund(object);
    else if (event.type === "refund.failed") {
      await database.from("refund_requests").update({ status: "failed" }).eq("stripe_refund_id", object.id);
    }
    await database.from("stripe_events").update({
      processing_status: "processed", processed_at: new Date().toISOString(), last_error: null,
    }).eq("event_id", event.id);
    return { duplicate: false };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message.slice(0, 300) : "stripe_event_failed";
    await database.from("stripe_events").update({ processing_status: "failed", last_error: message }).eq("event_id", event.id);
    throw caught;
  }
}
