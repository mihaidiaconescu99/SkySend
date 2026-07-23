import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import { rowToOrder } from "@/lib/repositories/mappers/order-mapper";
import { getStripeServer } from "@/lib/stripe/server";
import type { Database } from "@/types/database";
import type { Order } from "@/types/order";

/* eslint-disable @typescript-eslint/no-explicit-any */

const refundableFailureCodes = new Set([
  "no_suitable_pickup_meeting_point",
  "no_suitable_dropoff_meeting_point",
]);

export async function processEligibleRefund(
  db: SupabaseClient<Database>,
  order: Order,
  failureCode: string,
) {
  if (!refundableFailureCodes.has(failureCode)) return "not_eligible" as const;

  const orders = new OrdersRepository(db);
  await orders.updatePaymentStatus(order.id, "refund_pending", "pending");

  if (!order.stripePaymentIntentId && !order.stripeChargeId) {
    await orders.updatePaymentStatus(order.id, "refund_pending", "failed");
    return "pending" as const;
  }

  try {
    const params: {
      payment_intent?: string;
      charge?: string;
      reason: "requested_by_customer";
      metadata: Record<string, string>;
    } = {
      reason: "requested_by_customer",
      metadata: { orderId: order.localOrderId, failureReason: failureCode },
    };
    if (order.stripePaymentIntentId) {
      params.payment_intent = order.stripePaymentIntentId;
    } else if (order.stripeChargeId) {
      params.charge = order.stripeChargeId;
    }

    const refund = await getStripeServer().refunds.create(params, {
      idempotencyKey: `skysend-refund:${order.id}:${failureCode}`,
    });
    const { data: existingRecord } = await db
      .from("payment_records")
      .select("id")
      .eq("stripe_refund_id", refund.id)
      .maybeSingle();

    if (!existingRecord) {
      await new PaymentRecordsRepository(db).create({
        orderId: order.id,
        profileId: order.senderProfileId,
        stripePaymentIntentId: order.stripePaymentIntentId,
        stripeChargeId: order.stripeChargeId,
        stripeRefundId: refund.id,
        amountMinor: refund.amount,
        currency: refund.currency.toUpperCase(),
        type: "refund",
        status: "succeeded",
      });
    }
    await orders.updatePaymentStatus(order.id, "refunded", "completed");
    return "completed" as const;
  } catch (error) {
    console.error("[refund-reconciliation] Stripe refund failed", error);
    await orders.updatePaymentStatus(order.id, "refund_pending", "failed");
    return "pending" as const;
  }
}

export async function reconcilePendingRefunds(db: SupabaseClient<Database>) {
  const { data, error } = await db
    .from("orders")
    .select("*")
    .eq("payment_status", "refund_pending")
    .eq("status", "failed")
    .limit(50);
  if (error) throw error;

  let completed = 0;
  let pending = 0;
  for (const row of data ?? []) {
    const order = rowToOrder(row);
    const failureCode = order.notes ?? "";
    const result = await processEligibleRefund(db, order, failureCode);
    if (result === "completed") completed += 1;
    if (result === "pending") pending += 1;
  }
  const database = db as any;
  const { data: queuedRequests, error: queueError } = await database
    .from("refund_requests")
    .select("*,order:orders(*)")
    .in("status", ["pending", "failed"])
    .order("created_at")
    .limit(50);
  if (queueError) throw queueError;
  let submitted = 0;
  for (const request of queuedRequests ?? []) {
    const order = request.order;
    if (!order || order.payment_status !== "refund_pending") continue;
    try {
      const refund = await getStripeServer().refunds.create({
        ...(order.stripe_payment_intent_id
          ? { payment_intent: order.stripe_payment_intent_id }
          : { charge: order.stripe_charge_id }),
        amount: request.amount_minor,
        metadata: {
          orderId: order.local_order_id,
          orderUuid: order.id,
          refundRequestId: request.id,
          failureReason: "customer_cancelled_before_dispatch",
        },
      }, { idempotencyKey: `skysend-predispatch-refund:${order.id}` });
      await database.from("refund_requests").update({
        stripe_refund_id: refund.id,
        status: "submitted",
      }).eq("id", request.id);
      submitted += 1;
    } catch (error) {
      console.error("[refund-reconciliation] queued refund failed", error);
      await database.from("refund_requests").update({ status: "pending" }).eq("id", request.id);
    }
  }
  return {
    scanned: (data?.length ?? 0) + (queuedRequests?.length ?? 0),
    completed,
    pending,
    submitted,
  };
}
