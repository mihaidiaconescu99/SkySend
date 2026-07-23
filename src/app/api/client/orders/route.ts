

import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { mapOrderSummary, mapOrderToCreatedDelivery } from "@/lib/client-orders-mappers";

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const supabase = createAdminSupabaseClient();
  const profiles = new ProfilesRepository(supabase);
  const profileResult = await profiles.getByClerkUserId(userId);

  if (!profileResult.ok) {
    console.error("[client/orders] profile lookup failed:", profileResult.error);
    return NextResponse.json(
      { error: profileResult.error.message },
      { status: 502 },
    );
  }

  if (!profileResult.data) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const profileId = profileResult.data.id;
  const ordersRepo = new OrdersRepository(supabase);
  const ordersResult = await ordersRepo.listByProfileId(profileId, {
    limit: 100,
    orderBy: "created_at",
    descending: true,
  });

  if (!ordersResult.ok) {
    console.error("[client/orders] list failed:", ordersResult.error);
    return NextResponse.json(
      { error: ordersResult.error.message },
      { status: 502 },
    );
  }

  const visibleOrders = ordersResult.data.filter(
    (order) => !["pending", "failed"].includes(order.paymentStatus),
  );
  const summaries = visibleOrders.map((order) => mapOrderSummary(order));

  const created = visibleOrders.map(mapOrderToCreatedDelivery);

  return NextResponse.json({ orders: summaries, created });
}
