import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { ensureOrderCommunication } from "@/lib/order-communications-server";
import type { OrderStatus, PaymentStatus, UpdateOrderInput } from "@/types/order";

const updateOrderStatusBodySchema = z.object({
  orderId: z.string().min(1),
  paymentStatus: z
    .enum(["unpaid", "processing", "paid", "failed", "refunded", "refund_pending"])
    .optional(),
  stripePaymentIntentId: z.string().nullable().optional(),
  fulfillmentStatus: z.string().nullable().optional(),
  refundStatus: z.string().nullable().optional(),
  fallbackReason: z.string().nullable().optional(),
  locale: z.enum(["ro", "en"]).default("ro"),
});

function mapPaymentStatus(status: string): PaymentStatus {
  switch (status) {
    case "paid":
    case "failed":
    case "refunded":
    case "refund_pending":
      return status;
    case "processing":
    case "unpaid":
    default:
      return "pending";
  }
}

function mapFulfillmentStatus(status?: string | null): OrderStatus | null {
  switch (status) {
    case "active_mission":
      return "in_progress";
    case "completed_mission":
      return "completed";
    case "failed_mission":
    case "fallback_required":
      return "failed";
    case "canceled":
      return "cancelled";
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: z.infer<typeof updateOrderStatusBodySchema>;

  try {
    body = updateOrderStatusBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const profiles = new ProfilesRepository(supabase);
  const orders = new OrdersRepository(supabase);
  const paymentRecords = new PaymentRecordsRepository(supabase);
  const profileResult = await profiles.getByClerkUserId(userId);

  if (!profileResult.ok || !profileResult.data) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  let orderResult = await orders.getByLocalOrderId(body.orderId);

  if (orderResult.ok && !orderResult.data) {
    orderResult = await orders.getById(body.orderId);
  }

  if (!orderResult.ok) {
    return NextResponse.json({ error: "Order lookup failed." }, { status: 502 });
  }

  if (!orderResult.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const order = orderResult.data;

  if (order.senderProfileId !== profileResult.data.id) {
    return NextResponse.json(
      { error: "Order does not belong to this account." },
      { status: 403 },
    );
  }

  const patch: UpdateOrderInput = {};
  const nextOrderStatus = mapFulfillmentStatus(body.fulfillmentStatus);

  if (body.paymentStatus) {
    patch.paymentStatus = mapPaymentStatus(body.paymentStatus);
  }

  if (body.stripePaymentIntentId !== undefined) {
    patch.stripePaymentIntentId = body.stripePaymentIntentId;
  }

  if (body.fulfillmentStatus !== undefined) {
    patch.fulfillmentStatus = body.fulfillmentStatus;
  }

  if (nextOrderStatus) {
    patch.status = nextOrderStatus;
  }

  if (body.refundStatus !== undefined) {
    patch.refundStatus = body.refundStatus;
  }

  if (body.fallbackReason !== undefined) {
    patch.notes = body.fallbackReason;
  }

  const updated = await orders.updateById(order.id, patch);

  if (!updated.ok) {
    return NextResponse.json({ error: updated.error.message }, { status: 502 });
  }

  if (patch.paymentStatus === "paid") {
    const existingRecords = await paymentRecords.listByOrderId(order.id);
    const hasPaymentRecord =
      existingRecords.ok &&
      existingRecords.data.some(
        (record) =>
          record.type === "payment" &&
          record.status === "succeeded" &&
          record.stripePaymentIntentId ===
            (patch.stripePaymentIntentId ?? order.stripePaymentIntentId),
      );

    if (!hasPaymentRecord) {
      await paymentRecords.create({
        orderId: order.id,
        profileId: profileResult.data.id,
        stripePaymentIntentId:
          patch.stripePaymentIntentId ?? order.stripePaymentIntentId,
        amountMinor: order.totalAmountMinor,
        currency: order.currency,
        type: "payment",
        status: "succeeded",
      });
    }
    try {
      await ensureOrderCommunication({
        supabase,
        order: updated.data,
        profile: profileResult.data,
        locale: body.locale,
        origin: new URL(request.url).origin,
      });
    } catch (error) {
      console.error("[orders/update-status] communication scheduling failed", error);
    }
  }

  return NextResponse.json({ ok: true, order: updated.data });
}
