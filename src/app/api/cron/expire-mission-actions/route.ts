import "server-only";

import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { MissionsRepository } from "@/lib/repositories/missions-repository";
import { expireMissionIfDue } from "@/lib/mission-expiration-server";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminSupabaseClient();
  const missions = new MissionsRepository(db);
  const expired = await missions.listExpiredActionTimers();
  if (!expired.ok) {
    console.error("[expire-mission-actions] lookup failed", expired.error);
    return NextResponse.json({ error: "mission_expiration_lookup_failed" }, { status: 502 });
  }

  let processed = 0;
  for (const mission of expired.data) {
    if (await expireMissionIfDue(db, mission)) processed += 1;
  }

  return NextResponse.json({ ok: true, processed });
}
