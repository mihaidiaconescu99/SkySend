import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { requireSameOrigin } from "@/lib/api/request-security";
import { opaqueIdentifierSchema } from "@/lib/api/input-schemas";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { getStripeServer } from "@/lib/stripe/server";
import { getOrderIdentifierColumn } from "@/lib/orders/order-identifier";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { orderId } = await context.params;
  if (!opaqueIdentifierSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "invalid_order_identifier" }, { status: 400 });
  }
  const supabase = createAdminSupabaseClient();
  const db = supabase as any;
  const profile = await new ProfilesRepository(supabase).getByClerkUserId(userId);
  if (!profile.ok || !profile.data) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  const { data: order } = await db.from("orders").select("*")
    .eq(getOrderIdentifierColumn(orderId), orderId)
    .eq("sender_profile_id", profile.data.id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (order.payment_status !== "paid" || order.status !== "in_progress") {
    return NextResponse.json({ error: "dispatch_already_started" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: claimed, error: claimError } = await db.rpc("claim_predispatch_cancellation", {
    p_order_id: order.id,
    p_profile_id: profile.data.id,
  });
  if (claimError) {
    console.error("[predispatch-cancel] claim failed", claimError);
    return NextResponse.json({ error: "cancellation_claim_failed" }, { status: 502 });
  }
  if (!claimed) return NextResponse.json({ error: "dispatch_already_started" }, { status: 409 });

  const { data: requestRow, error: requestError } = await db.from("refund_requests").insert({
    order_id: order.id,
    requested_by_profile_id: profile.data.id,
    amount_minor: order.total_amount_minor,
    reason: "Anulare de client în fereastra pre-dispatch de 7 secunde.",
  }).select("id").single();
  if (requestError) {
    await db.from("orders").update({ refund_status: "failed" }).eq("id", order.id);
    return NextResponse.json({ error: "refund_request_failed" }, { status: 502 });
  }

  try {
    const refund = await getStripeServer().refunds.create({
      ...(order.stripe_payment_intent_id
        ? { payment_intent: order.stripe_payment_intent_id }
        : { charge: order.stripe_charge_id }),
      amount: order.total_amount_minor,
      metadata: {
        orderId: order.local_order_id,
        orderUuid: order.id,
        refundRequestId: requestRow.id,
        failureReason: "customer_cancelled_before_dispatch",
      },
    }, { idempotencyKey: `skysend-predispatch-refund:${order.id}` });
    await Promise.all([
      db.from("refund_requests").update({ stripe_refund_id: refund.id, status: "submitted" }).eq("id", requestRow.id),
      db.from("missions").update({ current_status: "mission_failed", failure_code: "customer_cancelled_before_dispatch", failed_at: now }).eq("order_id", order.id),
    ]);
    return NextResponse.json({ ok: true, refundId: refund.id, status: refund.status });
  } catch (error) {
    console.error("[predispatch-cancel] refund", error);
    await Promise.all([
      db.from("refund_requests").update({ status: "pending" }).eq("id", requestRow.id),
      db.from("orders").update({ refund_status: "pending" }).eq("id", order.id),
    ]);
    return NextResponse.json({ ok: true, refundStatus: "retry_pending" }, { status: 202 });
  }
}
