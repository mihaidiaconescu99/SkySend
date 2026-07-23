import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { billingSnapshotSchema } from "@/lib/billing/validation";
import { saveBillingSnapshot } from "@/lib/billing/server";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const parsed = billingSnapshotSchema.safeParse(body?.billing);
  if (!parsed.success || typeof body?.orderId !== "string") {
    return NextResponse.json({ error: "validation_failed", issues: parsed.error?.issues }, { status: 400 });
  }
  const supabase = createAdminSupabaseClient();
  const profile = await new ProfilesRepository(supabase).getByClerkUserId(userId);
  if (!profile.ok || !profile.data) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  try {
    const snapshot = await saveBillingSnapshot(profile.data.id, body.orderId, parsed.data, supabase);
    return NextResponse.json({ ok: true, snapshotId: snapshot.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "billing_save_failed";
    const status = message === "order_not_found" ? 404 : message === "billing_snapshot_locked" ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

