import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { opaqueIdentifierSchema } from "@/lib/api/input-schemas";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { requireSameOrigin } from "@/lib/api/request-security";
import { ensureOrderMission } from "@/lib/mission-bootstrap-server";
import { expireMissionIfDue } from "@/lib/mission-expiration-server";
import { getOrderIdentifierColumn } from "@/lib/orders/order-identifier";
import { MissionsRepository } from "@/lib/repositories/missions-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ orderId: string }> },
) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const rateLimit = await enforceRateLimit(request, "tracking-action");
  if (rateLimit) return rateLimit;
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { orderId } = await context.params;
  if (!opaqueIdentifierSchema.safeParse(orderId).success) {
    return NextResponse.json({ error: "invalid_order_identifier" }, { status: 400 });
  }

  const db = createAdminSupabaseClient();
  const profile = await new ProfilesRepository(db).getByClerkUserId(userId);
  if (!profile.ok || !profile.data) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }
  const { data: row } = await db
    .from("orders")
    .select("*")
    .eq(getOrderIdentifierColumn(orderId), orderId)
    .eq("sender_profile_id", profile.data.id)
    .maybeSingle();
  if (!row) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const orders = await import("@/lib/repositories/mappers/order-mapper");
  const order = orders.rowToOrder(row);
  if (order.paymentStatus !== "paid") {
    return NextResponse.json({ error: "payment_required" }, { status: 409 });
  }
  if (order.dispatchStartsAt && Date.parse(order.dispatchStartsAt) > Date.now()) {
    return NextResponse.json({ error: "dispatch_not_due" }, { status: 409 });
  }

  let mission = await ensureOrderMission(db, order);
  if (!mission) {
    return NextResponse.json({ error: "mission_unavailable" }, { status: 409 });
  }
  if (mission.currentStatus === "mission_created") {
    await expireMissionIfDue(db, mission);
    const refreshed = await new MissionsRepository(db).getByOrderId(order.id);
    if (refreshed.ok && refreshed.data) mission = refreshed.data;
  }

  return NextResponse.json({ ok: true, mission });
}
