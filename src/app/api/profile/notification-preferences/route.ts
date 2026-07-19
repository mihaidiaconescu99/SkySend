import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";

const bodySchema = z.object({
  popup: z.boolean(),
  email: z.boolean(),
});

export async function PATCH(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;

  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const profiles = new ProfilesRepository(createAdminSupabaseClient());
  const profile = await profiles.getByClerkUserId(userId);

  if (!profile.ok || !profile.data) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const updated = await profiles.updateById(profile.data.id, {
    notificationPreferences: body,
  });

  if (!updated.ok) {
    return NextResponse.json({ error: updated.error.message }, { status: 502 });
  }

  return NextResponse.json({ profile: updated.data });
}
