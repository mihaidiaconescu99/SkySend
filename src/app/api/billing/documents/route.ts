import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { listBillingDocumentsForOwnedOrder } from "@/lib/billing/server";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const orderId = new URL(request.url).searchParams.get("orderId");
  if (!orderId) return NextResponse.json({ error: "order_id_required" }, { status: 400 });
  const supabase = createAdminSupabaseClient();
  const profile = await new ProfilesRepository(supabase).getByClerkUserId(userId);
  if (!profile.ok || !profile.data) return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  try {
    return NextResponse.json({ documents: await listBillingDocumentsForOwnedOrder(profile.data.id, orderId, supabase) });
  } catch {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
}

