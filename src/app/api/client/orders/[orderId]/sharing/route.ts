import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getTrustedAppOrigin } from "@/lib/api/request-security";
import { z } from "zod";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { opaqueIdentifierSchema } from "@/lib/api/input-schemas";
import { validateRequest } from "@/lib/api/validation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import {
  ensureTrackingLinks,
  isOrderTerminal,
  rotateTrackingLink,
} from "@/lib/tracking-access-server";
import type { Order } from "@/types/order";

type RouteContext = { params: Promise<{ orderId: string }> };

const patchSchema = z.object({
  publicCodeAccessMode: z.enum(["view", "control"]).optional(),
  rotateScope: z.enum(["full", "pickup", "dropoff"]).optional(),
}).strict().refine(
  (value) => value.publicCodeAccessMode !== undefined || value.rotateScope !== undefined,
  { message: "empty_patch" },
);

async function getOwnedOrder(orderId: string) {
  if (!opaqueIdentifierSchema.safeParse(orderId).success) {
    return { error: "Invalid order identifier.", status: 400 } as const;
  }
  const { userId } = await auth();
  if (!userId) return { error: "Authentication required.", status: 401 } as const;

  const db = createAdminSupabaseClient();
  const profile = await new ProfilesRepository(db).getByClerkUserId(userId);
  if (!profile.ok || !profile.data) {
    return { error: "Profile not found.", status: 404 } as const;
  }

  const orders = new OrdersRepository(db);
  let result = await orders.getByLocalOrderId(orderId);
  if (result.ok && !result.data) result = await orders.getById(orderId);
  if (!result.ok || !result.data) {
    return { error: "Order not found.", status: 404 } as const;
  }
  if (result.data.senderProfileId !== profile.data.id) {
    return { error: "Forbidden.", status: 403 } as const;
  }

  return { db, orders, order: result.data } as const;
}

function toResponse(
  request: Request,
  order: Order,
  links: Array<{ scope: string; token: string }>,
) {
  let origin: string;
  try {
    origin = getTrustedAppOrigin(request);
  } catch {
    return NextResponse.json({ error: "origin_not_configured" }, { status: 503 });
  }
  return {
    publicCodeAccessMode: order.publicCodeAccessMode,
    terminal: isOrderTerminal(order),
    links: Object.fromEntries(
      links.map((link) => [link.scope, `${origin}/track/${encodeURIComponent(link.token)}`]),
    ),
  };
}

export async function GET(request: Request, { params }: RouteContext) {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const { orderId } = await params;
  const owned = await getOwnedOrder(orderId);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const links = await ensureTrackingLinks(owned.db, owned.order);
  return NextResponse.json(toResponse(request, owned.order, links));
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const { orderId } = await params;
  const owned = await getOwnedOrder(orderId);
  if ("error" in owned) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }
  if (isOrderTerminal(owned.order)) {
    return NextResponse.json({ error: "Terminal orders are read-only." }, { status: 409 });
  }

  const parsed = await validateRequest(patchSchema, request, { maxBytes: 4 * 1024 });
  if (!parsed.ok) return parsed.response;

  let order = owned.order;
  if (parsed.data.publicCodeAccessMode) {
    const updated = await owned.orders.updateById(order.id, {
      publicCodeAccessMode: parsed.data.publicCodeAccessMode,
    });
    if (!updated.ok) {
      console.error("[orders/sharing] update failed", updated.error);
      return NextResponse.json({ error: "Sharing update failed." }, { status: 502 });
    }
    order = updated.data;
  }

  if (parsed.data.rotateScope) {
    await rotateTrackingLink(owned.db, order.id, parsed.data.rotateScope);
  }

  const links = await ensureTrackingLinks(owned.db, order);
  return NextResponse.json(toResponse(request, order, links));
}
