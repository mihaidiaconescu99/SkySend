import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  normalizedEmailSchema,
  plainTextSchema,
} from "@/lib/api/input-schemas";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { getServerAuthorizationContext } from "@/lib/server-authorization";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const clerkProfileSchema = z.object({
  clerkUserId: z.string().trim().min(1).max(200),
  email: normalizedEmailSchema,
  fullName: plainTextSchema(1, 160).nullable(),
}).strict();

export async function POST() {
  try {

    const authorization = await getServerAuthorizationContext();
    if (!authorization.userId) {
      return NextResponse.json(
        { error: "unauthenticated" },
        { status: 401 },
      );
    }
    if (authorization.resolution !== "resolved") {
      return NextResponse.json(
        { error: "authorization_unavailable" },
        { status: 503 },
      );
    }
    if (!authorization.role) {
      return NextResponse.json(
        { error: "forbidden" },
        { status: 403 },
      );
    }
    const userId = authorization.userId;

    const user = await currentUser();
    if (!user || user.id !== userId) {
      return NextResponse.json(
        { error: "user_not_found" },
        { status: 401 },
      );
    }

    const rawEmail =
      user.emailAddresses.find(
        (address) => address.id === user.primaryEmailAddressId,
      )?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
    if (!rawEmail) {
      return NextResponse.json(
        { error: "missing_email" },
        { status: 422 },
      );
    }

    const fullName =
      user.fullName ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      null;
    const identity = clerkProfileSchema.safeParse({
      clerkUserId: userId,
      email: rawEmail,
      fullName,
    });
    if (!identity.success) {
      return NextResponse.json(
        { error: "invalid_identity_data" },
        { status: 422 },
      );
    }

    const supabase = createAdminSupabaseClient();

    const { data: profileId, error: rpcError } = await supabase.rpc(
      "ensure_profile_exists",
      {
        p_clerk_user_id: identity.data.clerkUserId,
        p_email: identity.data.email,

        ...(identity.data.fullName ? { p_full_name: identity.data.fullName } : {}),
      },
    );

    if (rpcError) {
      console.error("[sync-profile] RPC error:", rpcError);
      return NextResponse.json(
        { error: "sync_failed" },
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
        { error: "fetch_failed" },
        { status: 500 },
      );
    }

    if (!result.data) {

      return NextResponse.json(
        { error: "sync_inconsistent" },
        { status: 500 },
      );
    }

    let profile = result.data;
    if (profile.role !== authorization.role) {
      const updated = await repository.updateById(profile.id, {
        role: authorization.role,
      });
      if (!updated.ok) {
        return NextResponse.json(
          { error: "role_sync_failed" },
          { status: 500 },
        );
      }
      profile = updated.data;
    }

    return NextResponse.json({ profile }, { status: 200 });
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
