import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { localOrderIdSchema } from "@/lib/api/input-schemas";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { billingSnapshotSchema } from "@/lib/billing/validation";
import { saveBillingSnapshot } from "@/lib/billing/server";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const requestSchema = z.object({
  billing: billingSnapshotSchema,
  orderId: localOrderIdSchema,
}).strict();

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(requestSchema, request, { maxBytes: 16 * 1024 });
  if (!parsed.ok) return parsed.response;
  const supabase = createAdminSupabaseClient();
  const profile = await new ProfilesRepository(supabase).getByClerkUserId(userId);
  if (!profile.ok || !profile.data) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  try {
    const snapshot = await saveBillingSnapshot(
      profile.data.id,
      parsed.data.orderId,
      parsed.data.billing,
      supabase,
    );
    return NextResponse.json({ ok: true, snapshotId: snapshot.id });
  } catch (error) {
    const message = publicErrorCode(
      error,
      ["order_not_found", "billing_snapshot_locked"] as const,
      "billing_save_failed",
    );
    const status = message === "order_not_found" ? 404 : message === "billing_snapshot_locked" ? 409 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
