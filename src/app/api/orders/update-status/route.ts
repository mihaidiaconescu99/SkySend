import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { validateRequest } from "@/lib/api/validation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import {
  isAllowedFulfillmentTransition,
  updateOrderStatusBodySchema,
} from "@/lib/orders/status-input";
import type { OrderStatus, UpdateOrderInput } from "@/types/order";

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

  const parsed = await validateRequest(updateOrderStatusBodySchema, request, {
    maxBytes: 8 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const supabase = createAdminSupabaseClient();
  const profiles = new ProfilesRepository(supabase);
  const orders = new OrdersRepository(supabase);
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

  if (
    !isAllowedFulfillmentTransition(
      order.fulfillmentStatus,
      body.fulfillmentStatus,
    )
  ) {
    return NextResponse.json(
      { error: "invalid_fulfillment_transition" },
      { status: 409 },
    );
  }
  if (body.fulfillmentStatus === order.fulfillmentStatus) {
    return NextResponse.json({ ok: true, order });
  }

  const patch: UpdateOrderInput = {};
  const nextOrderStatus = mapFulfillmentStatus(body.fulfillmentStatus);

  patch.fulfillmentStatus = body.fulfillmentStatus;

  if (nextOrderStatus) {
    patch.status = nextOrderStatus;
  }

  if (body.fallbackReason !== undefined) {
    patch.notes = body.fallbackReason;
  }

  const updated = await orders.updateById(order.id, patch);

  if (!updated.ok) {
    console.error("[orders/update-status] update failed", updated.error);
    return NextResponse.json({ error: "Order update failed." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, order: updated.data });
}
