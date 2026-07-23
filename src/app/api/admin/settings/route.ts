import { NextResponse } from "next/server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";

import { requireAdminPanelUser } from "@/lib/admin-auth";
import { getOperationalStatusSnapshot } from "@/lib/operational-status-server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const settingsSchema = z.object({
  serviceRadiusKm: z.number().positive().max(50),
  basePriceMinor: z.number().int().nonnegative().max(1_000_000),
  pricePerKmMinor: z.number().int().nonnegative().max(1_000_000),
  confirmationTimerMinutes: z.number().int().min(1).max(60),
  loadingTimerMinutes: z.number().int().min(1).max(60),
  unloadingTimerMinutes: z.number().int().min(1).max(60),
  manualStatus: z.enum(["active", "maintenance"]),
});

export async function PUT(request: Request) {
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error.issues }, { status: 400 });
  }
  const supabase = createAdminSupabaseClient() as any;
  const now = new Date().toISOString();
  const before = await getOperationalStatusSnapshot();
  const { error } = await supabase.from("operational_settings").update({
    service_radius_km: parsed.data.serviceRadiusKm,
    base_price_minor: parsed.data.basePriceMinor,
    price_per_km_minor: parsed.data.pricePerKmMinor,
    confirmation_timer_minutes: parsed.data.confirmationTimerMinutes,
    loading_timer_minutes: parsed.data.loadingTimerMinutes,
    unloading_timer_minutes: parsed.data.unloadingTimerMinutes,
    manual_status: parsed.data.manualStatus,
    is_active: parsed.data.manualStatus === "active",
    last_saved_at: now,
    last_saved_by: authResult.profile.id,
  }).eq("is_singleton", true);
  if (error) return NextResponse.json({ error: "settings_save_failed" }, { status: 502 });

  if (parsed.data.manualStatus === "maintenance") {
    await supabase.from("platform_override_state").update({
      cancelled_at: now,
      cancelled_by: authResult.profile.id,
    }).eq("id", "default");
  } else if (before.weather.level === "suspended") {
    await supabase.rpc("activate_platform_override", {
      p_actor_profile_id: authResult.profile.id,
    });
  }
  return NextResponse.json({ ok: true, snapshot: await getOperationalStatusSnapshot() });
}
