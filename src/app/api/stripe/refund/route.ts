

import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getStripeServer } from "@/lib/stripe/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";

export const refundBodySchema = z.object({

  orderId: z.string().min(1),
  reason: z.string().optional(),
});

export async function POST(request: Request) {

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: z.infer<typeof refundBodySchema>;
  try {
    body = refundBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const adminSupabase = createAdminSupabaseClient();
  const profiles = new ProfilesRepository(adminSupabase);
  const orders = new OrdersRepository(adminSupabase);
  const paymentRecords = new PaymentRecordsRepository(adminSupabase);

  const profileResult = await profiles.getByClerkUserId(userId);
  if (!profileResult.ok || !profileResult.data) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }
  const profileId = profileResult.data.id;

  let orderLookup = await orders.getByLocalOrderId(body.orderId);
  if (!orderLookup.ok) {
    return NextResponse.json({ error: "Order lookup failed." }, { status: 502 });
  }
  if (!orderLookup.data) {
    orderLookup = await orders.getById(body.orderId);
    if (!orderLookup.ok) {
      return NextResponse.json({ error: "Order lookup failed." }, { status: 502 });
    }
    if (!orderLookup.data) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
  }
  const order = orderLookup.data;

  if (order.senderProfileId !== profileId) {
    return NextResponse.json(
      { error: "Order does not belong to this account." },
      { status: 403 },
    );
  }

  if (!order.stripePaymentIntentId && !order.stripeChargeId) {
    return NextResponse.json(
      { error: "Order has no associated Stripe payment." },
      { status: 400 },
    );
  }

  if (order.paymentStatus === "refunded") {
    return NextResponse.json(
      { error: "Order has already been refunded." },
      { status: 409 },
    );
  }

  if (order.paymentStatus !== "paid" && order.paymentStatus !== "refund_pending") {
    return NextResponse.json(
      {
        error: `Order payment status "${order.paymentStatus}" is not eligible for refund.`,
      },
      { status: 400 },
    );
  }

  const stripe = getStripeServer();

  try {
    await orders.updatePaymentStatus(order.id, "refund_pending", "pending");
    const refundParams: Parameters<typeof stripe.refunds.create>[0] = {
      reason: "requested_by_customer",
      metadata: {
        orderId: order.localOrderId,
        failureReason: body.reason ?? "manual",
      },
    };

    if (order.stripePaymentIntentId) {
      refundParams.payment_intent = order.stripePaymentIntentId;
    } else if (order.stripeChargeId) {
      refundParams.charge = order.stripeChargeId;
    }

    const stripeRefund = await stripe.refunds.create(refundParams, {
      idempotencyKey: `skysend-refund:${order.id}:${body.reason ?? "manual"}`,
    });

    await orders.updatePaymentStatus(order.id, "refunded", "completed");

    await paymentRecords.create({
      orderId: order.id,
      profileId,
      stripePaymentIntentId: order.stripePaymentIntentId,
      stripeChargeId: order.stripeChargeId,
      stripeRefundId: stripeRefund.id,
      amountMinor: stripeRefund.amount,
      currency: stripeRefund.currency.toUpperCase(),
      type: "refund",
      status: "succeeded",
    });

    return NextResponse.json({
      success: true,
      refundId: stripeRefund.id,
      status: stripeRefund.status,
    });
  } catch (err) {
    console.error("[stripe/refund] Stripe refund call failed:", err);

    await orders
      .updatePaymentStatus(order.id, "refund_pending", "failed")
      .catch((updateErr) => {
        console.error("[stripe/refund] Could not update order refundStatus:", updateErr);
      });

    return NextResponse.json(
      {
        error:
          "Stripe refund could not be processed. The order has been flagged for manual review.",
      },
      { status: 502 },
    );
  }
}
