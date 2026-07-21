import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import { rowToOrder } from "@/lib/repositories/mappers/order-mapper";
import { getStripeServer } from "@/lib/stripe/server";
import type { Database } from "@/types/database";
import type { Order } from "@/types/order";

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
  return { scanned: data?.length ?? 0, completed, pending };
}
