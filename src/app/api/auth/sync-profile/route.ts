import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST() {
  try {

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 },
      );
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: "user_not_found" },
        { status: 401 },
      );
    }

    const email = user.emailAddresses[0]?.emailAddress;
    if (!email) {
      return NextResponse.json(
        { error: "missing_email" },
        { status: 422 },
      );
    }

    const fullName =
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      null;

    const supabase = createAdminSupabaseClient();

    const { data: profileId, error: rpcError } = await supabase.rpc(
      "ensure_profile_exists",
      {
        p_clerk_user_id: userId,
        p_email: email,

        ...(fullName ? { p_full_name: fullName } : {}),
      },
    );

    if (rpcError) {
      console.error("[sync-profile] RPC error:", rpcError);
      return NextResponse.json(
        { error: "sync_failed", details: rpcError.message },
        { status: 500 },
      );
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "sync_failed", details: "No profile ID returned." },
        { status: 500 },
      );
    }

    const repository = new ProfilesRepository(supabase);
    const result = await repository.getById(profileId);

    if (!result.ok) {
      console.error("[sync-profile] Fetch failed:", result.error);
      return NextResponse.json(
        { error: "fetch_failed", details: result.error.message },
        { status: 500 },
      );
    }

    if (!result.data) {

      return NextResponse.json(
        { error: "sync_inconsistent" },
        { status: 500 },
      );
    }

    return NextResponse.json({ profile: result.data }, { status: 200 });
  } catch (error) {
    console.error("[sync-profile] Unexpected error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json(
    { error: "method_not_allowed" },
    { status: 405 },
  );
}
