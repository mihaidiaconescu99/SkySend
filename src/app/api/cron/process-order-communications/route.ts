import { NextResponse } from "next/server";
import { bearerSecretMatches, getTrustedAppOrigin } from "@/lib/api/request-security";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ensureOrderCommunication } from "@/lib/order-communications-server";
import { OrdersRepository } from "@/lib/repositories/orders-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!bearerSecretMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const database = supabase as never as { from: (table: string) => any };
  const ordersRepo = new OrdersRepository(supabase);
  const profilesRepo = new ProfilesRepository(supabase);
  const now = Date.now();
  const fourHours = 4 * 60 * 60 * 1000;
  let origin: string;
  try {
    origin = getTrustedAppOrigin(request);
  } catch {
    return NextResponse.json({ error: "origin_not_configured" }, { status: 503 });
  }
  let processed = 0;

  const { data: scheduledRows } = await database.from("orders")
    .select("id,sender_profile_id,scheduled_at,created_at,status,payment_status")
    .eq("dispatch_timing", "scheduled")
    .eq("payment_status", "paid")
    .in("status", ["pending", "in_progress"])
    .gt("scheduled_at", new Date(now).toISOString())
    .lte("scheduled_at", new Date(now + fourHours).toISOString())
    .limit(200);

  const due = (scheduledRows ?? []).filter((row: any) => {
    const scheduledAt = Date.parse(row.scheduled_at);
    const createdAt = Date.parse(row.created_at);
    return scheduledAt - createdAt > fourHours && scheduledAt - fourHours <= now;
  });

  const { data: failedConfirmations } = await database.from("order_communication_events")
    .select("order_id,profile_id,locale")
    .eq("event_type", "confirmation")
    .in("email_status", ["pending", "failed"])
    .lt("email_attempt_count", 6)
    .limit(100);

  const dueOrderIds = due.map((row: any) => row.id);
  const { data: confirmationLocales } = dueOrderIds.length
    ? await database.from("order_communication_events")
        .select("order_id,locale")
        .eq("event_type", "confirmation")
        .in("order_id", dueOrderIds)
    : { data: [] };
  const localeByOrder = new Map(
    (confirmationLocales ?? []).map((row: any) => [row.order_id, row.locale]),
  );

  for (const candidate of [
    ...due.map((row: any) => ({ orderId: row.id, profileId: row.sender_profile_id, locale: localeByOrder.get(row.id) ?? "ro", eventType: "scheduled_reminder" as const })),
    ...(failedConfirmations ?? []).map((row: any) => ({ orderId: row.order_id, profileId: row.profile_id, locale: row.locale, eventType: "confirmation" as const })),
  ]) {
    const [orderResult, profileResult] = await Promise.all([
      ordersRepo.getById(candidate.orderId),
      profilesRepo.getById(candidate.profileId),
    ]);
    if (!orderResult.ok || !orderResult.data || !profileResult.ok || !profileResult.data) continue;
    if (["completed", "failed", "cancelled"].includes(orderResult.data.status)) continue;
    await ensureOrderCommunication({
      supabase,
      order: orderResult.data,
      profile: profileResult.data,
      locale: candidate.locale === "en" ? "en" : "ro",
      origin,
      eventType: candidate.eventType,
    });
    processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}
