import "server-only";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  internalActionUrlSchema,
  plainTextSchema,
} from "@/lib/api/input-schemas";
import { validateRequest } from "@/lib/api/validation";
import { NotificationsRepository } from "@/lib/repositories/notifications-repository";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  title: plainTextSchema(1, 160),
  message: plainTextSchema(1, 2_000),
  type: z.enum(["order", "mission", "payment", "system"]),
  actionUrl: internalActionUrlSchema.nullable().optional(),
}).strict();

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const parsed = await validateRequest(bodySchema, request, {
    maxBytes: 8 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

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
    console.error("[notifications] create failed", created.error);
    return NextResponse.json({ error: "notification_create_failed" }, { status: 502 });
  }

  return NextResponse.json({ notification: created.data });
}
