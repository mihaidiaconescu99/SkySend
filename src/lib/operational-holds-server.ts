import "server-only";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getOperationalStatusSnapshot } from "@/lib/operational-status-server";

const preflightStatuses = ["mission_created", "preflight_checks"];

export async function reconcileOperationalMissionHolds(now = new Date()) {
  const supabase = createAdminSupabaseClient() as any;
  const status = await getOperationalStatusSnapshot(createAdminSupabaseClient(), now);
  const forecasts = Array.isArray(status.weather.metrics.forecasts)
    ? status.weather.metrics.forecasts as Array<{ level?: string }>
    : [];
  const projectedSuspension = forecasts.some((forecast) => forecast.level === "suspended");
  let held = 0;
  let resumed = 0;

  if (status.effectiveStatus !== "active") {
    const { data: missions } = await supabase.from("missions")
      .select("id,step_expires_at")
      .in("current_status", preflightStatuses)
      .is("operational_hold_reason", null)
      .limit(200);
    for (const mission of missions ?? []) {
      const remaining = mission.step_expires_at
        ? Math.max(0, Math.ceil((Date.parse(mission.step_expires_at) - now.getTime()) / 1000))
        : null;
      await supabase.from("missions").update({
        operational_hold_reason: status.effectiveStatus === "suspended" ? "weather_suspended" : "manual_maintenance",
        operational_held_at: now.toISOString(),
        operational_hold_remaining_seconds: remaining,
        step_expires_at: null,
      }).eq("id", mission.id).is("operational_hold_reason", null);
      held += 1;
    }
  } else if (!projectedSuspension && status.weather.checkStatus === "success") {
    const { data: missions } = await supabase.from("missions")
      .select("id,operational_hold_remaining_seconds")
      .not("operational_hold_reason", "is", null)
      .in("current_status", preflightStatuses)
      .limit(200);
    for (const mission of missions ?? []) {
      const seconds = Number(mission.operational_hold_remaining_seconds ?? 0);
      await supabase.from("missions").update({
        operational_hold_reason: null,
        operational_held_at: null,
        operational_hold_remaining_seconds: null,
        step_expires_at: seconds > 0 ? new Date(now.getTime() + seconds * 1_000).toISOString() : null,
      }).eq("id", mission.id);
      resumed += 1;
    }
  }
  return { held, resumed, projectedSuspension };
}
