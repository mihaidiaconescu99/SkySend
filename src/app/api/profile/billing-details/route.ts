import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/api/validation";
import { requireSameOrigin } from "@/lib/api/request-security";
import { savedBillingProfileSchema } from "@/lib/billing/validation";
import { getSavedBillingProfile, saveBillingProfile } from "@/lib/checkout/server";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

async function context() {
  const { userId } = await auth();
  if (!userId) return null;
  const supabase = createAdminSupabaseClient();
  const profile = await new ProfilesRepository(supabase).getByClerkUserId(userId);
  return profile.ok && profile.data ? { supabase, profile: profile.data } : null;
}

export async function GET() {
  const actor = await context();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  return NextResponse.json({ billing: await getSavedBillingProfile(actor.supabase, actor.profile.id) });
}

export async function PUT(request: Request) {
  const actor = await context();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(savedBillingProfileSchema, request, {
    maxBytes: 16 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  return NextResponse.json({
    billing: await saveBillingProfile(actor.supabase, actor.profile.id, parsed.data),
  });
}

export async function DELETE(request: Request) {
  const originFailure = requireSameOrigin(request);
  if (originFailure) return originFailure;
  const actor = await context();
  if (!actor) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { error } = await (actor.supabase as never as {
    from: (name: string) => { delete: () => { eq: (key: string, value: string) => Promise<{ error: Error | null }> } };
  }).from("profile_billing_details").delete().eq("profile_id", actor.profile.id);
  if (error) {
    console.error("[billing-details] delete failed", error);
    return NextResponse.json({ error: "billing_delete_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
