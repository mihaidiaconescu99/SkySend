import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { NotificationsRepository } from "@/lib/repositories/notifications-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  type: z.enum(["order", "mission", "payment", "system"]),
  actionUrl: z.string().nullable().optional(),
});

export async function POST(request: Request) {
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

  const supabase = createAdminSupabaseClient();
  const profiles = new ProfilesRepository(supabase);
  const profile = await profiles.getByClerkUserId(userId);

  if (!profile.ok || !profile.data) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const created = await new NotificationsRepository(supabase).create({
    profileId: profile.data.id,
    title: body.title,
    message: body.message,
    type: body.type,
    actionUrl: body.actionUrl ?? undefined,
  });

  if (!created.ok) {
    return NextResponse.json({ error: created.error.message }, { status: 502 });
  }

  return NextResponse.json({ notification: created.data });
}
