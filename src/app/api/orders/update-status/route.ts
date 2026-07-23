import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import type { OrderStatus, UpdateOrderInput } from "@/types/order";

const updateOrderStatusBodySchema = z.object({
  orderId: z.string().min(1),
  fulfillmentStatus: z.string().nullable().optional(),
  fallbackReason: z.string().nullable().optional(),
}).strict();

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

  if (body.fulfillmentStatus !== undefined) {
    patch.fulfillmentStatus = body.fulfillmentStatus;
  }

  if (nextOrderStatus) {
    patch.status = nextOrderStatus;
  }

  if (body.fallbackReason !== undefined) {
    patch.notes = body.fallbackReason;
  }

  const updated = await orders.updateById(order.id, patch);

  if (!updated.ok) {
    return NextResponse.json({ error: updated.error.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true, order: updated.data });
}
