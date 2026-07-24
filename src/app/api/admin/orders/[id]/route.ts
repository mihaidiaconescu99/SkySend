

import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  opaqueIdentifierSchema,
  plainTextSchema,
} from "@/lib/api/input-schemas";
import { validateRequest } from "@/lib/api/validation";
import { requireAdminPanelUser } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { mapRepoOrderToAdminOrder } from "@/lib/admin-order-mapper";
import type { OrderStatus as DomainOrderStatus } from "@/types/domain";
import type { OrderStatus, UpdateOrderInput } from "@/types/order";

const PatchSchema = z
  .object({
    status: z
      .enum([
        "draft",
        "scheduled",
        "queued",
        "in_flight",
        "delivered",
        "failed",
        "cancelled",
        "returned",
      ])
      .optional(),
    fulfillmentStatus: z.enum([
      "order_created",
      "active_mission",
      "completed_mission",
      "failed_mission",
      "fallback_required",
      "canceled",
    ]).nullable().optional(),
    internalNotes: plainTextSchema(1, 2_000).nullable().optional(),
  })
  .strict();

function mapDomainStatusToRepo(
  status: DomainOrderStatus,
): OrderStatus | null {
  switch (status) {
    case "queued":
    case "scheduled":
    case "draft":
      return "pending";
    case "in_flight":
      return "in_progress";
    case "delivered":
      return "completed";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "returned":
      return null;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const { id } = await context.params;
  if (!opaqueIdentifierSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid order identifier." }, { status: 400 });
  }

  const parsed = await validateRequest(PatchSchema, request, {
    maxBytes: 8 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const supabase = createAdminSupabaseClient();
  const orders = new OrdersRepository(supabase);
  const existing = await orders.getById(id);
  if (!existing.ok) {
    return NextResponse.json({ error: "Order lookup failed." }, { status: 502 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const patch: UpdateOrderInput = {};

  if (body.status !== undefined) {
    const mapped = mapDomainStatusToRepo(body.status);
    if (mapped !== null) {
      patch.status = mapped;
    }
  }
  if (body.fulfillmentStatus !== undefined) {
    patch.fulfillmentStatus = body.fulfillmentStatus;
  }
  if (body.internalNotes !== undefined) {
    patch.notes = body.internalNotes;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({
      ok: true,
      order: mapRepoOrderToAdminOrder(existing.data),
    });
  }

  const updated = await orders.updateById(id, patch);
  if (!updated.ok) {
    console.error("[admin/orders] update failed:", updated.error);
    return NextResponse.json({ error: "Order update failed." }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    order: mapRepoOrderToAdminOrder(updated.data),
  });
}
