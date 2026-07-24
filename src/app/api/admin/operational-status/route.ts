import { NextResponse } from "next/server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { validateRequest } from "@/lib/api/validation";
import { requireAdminPanelUser } from "@/lib/admin-auth";
import { getOperationalStatusSnapshot } from "@/lib/operational-status-server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_manual_status"), status: z.enum(["active", "maintenance"]) }).strict(),
  z.object({ action: z.literal("cancel_override") }).strict(),
]);

export async function GET() {
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  return NextResponse.json(await getOperationalStatusSnapshot());
}

export async function POST(request: Request) {
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  const parsed = await validateRequest(schema, request, { maxBytes: 2 * 1024 });
  if (!parsed.ok) return parsed.response;
  const supabase = createAdminSupabaseClient() as any;
  const now = new Date();

  if (parsed.data.action === "cancel_override") {
    await supabase.from("platform_override_state").update({
      cancelled_at: now.toISOString(),
      cancelled_by: authResult.profile.id,
    }).eq("id", "default");
  } else {
    await supabase.from("operational_settings").update({
      manual_status: parsed.data.status,
      is_active: parsed.data.status === "active",
      last_saved_at: now.toISOString(),
      last_saved_by: authResult.profile.id,
    }).eq("is_singleton", true);
    const before = await getOperationalStatusSnapshot(createAdminSupabaseClient(), now);
    if (parsed.data.status === "maintenance") {
      await supabase.from("platform_override_state").update({
        cancelled_at: now.toISOString(),
        cancelled_by: authResult.profile.id,
      }).eq("id", "default");
    } else if (before.weather.level === "suspended") {
      await supabase.rpc("activate_platform_override", {
        p_actor_profile_id: authResult.profile.id,
      });
    }
  }
  return NextResponse.json({ ok: true, snapshot: await getOperationalStatusSnapshot() });
}
