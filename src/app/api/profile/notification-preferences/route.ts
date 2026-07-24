import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { validateRequest } from "@/lib/api/validation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";

const bodySchema = z.object({
  popup: z.boolean(),
  email: z.boolean(),
}).strict();

export async function PATCH(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const parsed = await validateRequest(bodySchema, request, { maxBytes: 2 * 1024 });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const profiles = new ProfilesRepository(createAdminSupabaseClient());
  const profile = await profiles.getByClerkUserId(userId);

  if (!profile.ok || !profile.data) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const updated = await profiles.updateById(profile.data.id, {
    notificationPreferences: body,
  });

  if (!updated.ok) {
    console.error("[notification-preferences] update failed", updated.error);
    return NextResponse.json({ error: "preferences_update_failed" }, { status: 502 });
  }

  return NextResponse.json({ profile: updated.data });
}
