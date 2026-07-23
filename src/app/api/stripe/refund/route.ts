import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPanelUser } from "@/lib/admin-auth";
import { getStripeServer } from "@/lib/stripe/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getOrderIdentifierColumn } from "@/lib/orders/order-identifier";

export const refundBodySchema = z.object({
  orderId: z.string().min(1),
  amountMinor: z.number().int().positive().optional(),
  reason: z.string().trim().min(3).max(300),
});

export async function POST(request: Request) {
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const parsed = refundBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_refund_request", issues: parsed.error.issues }, { status: 400 });
  }
  const supabase = createAdminSupabaseClient() as any;
  const { data: order } = await supabase.from("orders").select("*")
    .eq(getOrderIdentifierColumn(parsed.data.orderId), parsed.data.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (!["paid", "partially_refunded"].includes(order.payment_status)) {
    return NextResponse.json({ error: "payment_not_refundable" }, { status: 409 });
  }
  const { data: previous } = await supabase.from("payment_records")
    .select("amount_minor").eq("order_id", order.id)
    .in("type", ["refund", "partial_refund"]).eq("status", "succeeded");
  const refunded = (previous ?? []).reduce((sum: number, row: { amount_minor: number }) => sum + Number(row.amount_minor), 0);
  const refundable = Number(order.total_amount_minor) - refunded;
  const amount = parsed.data.amountMinor ?? refundable;
  if (amount <= 0 || amount > refundable) {
    return NextResponse.json({ error: "refund_amount_exceeds_balance", refundableAmountMinor: refundable }, { status: 400 });
  }
  const { data: refundRequest, error: insertError } = await supabase.from("refund_requests").insert({
    order_id: order.id,
    requested_by_profile_id: authResult.profile.id,
    amount_minor: amount,
    reason: parsed.data.reason,
  }).select("id").single();
  if (insertError) return NextResponse.json({ error: "refund_request_failed" }, { status: 502 });

  try {
    const refund = await getStripeServer().refunds.create({
      ...(order.stripe_payment_intent_id
        ? { payment_intent: order.stripe_payment_intent_id }
        : { charge: order.stripe_charge_id }),
      amount,
      metadata: {
        orderId: order.local_order_id,
        orderUuid: order.id,
        refundRequestId: refundRequest.id,
        failureReason: parsed.data.reason,
      },
    }, { idempotencyKey: `skysend-admin-refund:${refundRequest.id}` });
    await supabase.from("refund_requests").update({
      stripe_refund_id: refund.id,
      status: "submitted",
    }).eq("id", refundRequest.id);
    await supabase.from("orders").update({ refund_status: "pending" }).eq("id", order.id);
    return NextResponse.json({ ok: true, refundId: refund.id, status: refund.status });
  } catch (error) {
    await supabase.from("refund_requests").update({ status: "failed" }).eq("id", refundRequest.id);
    console.error("[stripe/refund]", error);
    return NextResponse.json({ error: "stripe_refund_failed" }, { status: 502 });
  }
}
