

import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  opaqueIdentifierSchema,
  plainTextSchema,
} from "@/lib/api/input-schemas";
import { validateRequest } from "@/lib/api/validation";
import { requireAdminPanelUser } from "@/lib/admin-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ContactMessagesRepository } from "@/lib/repositories/contact-messages-repository";
import { CONTACT_MESSAGE_STATUSES } from "@/types/contact-message";

const PatchSchema = z
  .object({
    status: z.enum(CONTACT_MESSAGE_STATUSES as readonly [string, ...string[]]).optional(),
    internalNote: plainTextSchema(1, 2_000).nullable().optional(),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminPanelUser();
  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status },
    );
  }

  const { id } = await context.params;
  if (!opaqueIdentifierSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Invalid message identifier." }, { status: 400 });
  }

  const parsed = await validateRequest(PatchSchema, request, {
    maxBytes: 8 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const supabase = createAdminSupabaseClient();
  const repo = new ContactMessagesRepository(supabase);

  const existing = await repo.getById(id);
  if (!existing.ok) {
    return NextResponse.json({ error: "Lookup failed." }, { status: 502 });
  }
  if (!existing.data) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const patch: { status?: typeof CONTACT_MESSAGE_STATUSES[number]; internalNote?: string | null } = {};

  if (body.status !== undefined) {
    patch.status = body.status as typeof CONTACT_MESSAGE_STATUSES[number];
  }
  if (body.internalNote !== undefined) {
    patch.internalNote = body.internalNote;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, message: existing.data });
  }

  const updated = await repo.updateById(id, patch);
  if (!updated.ok) {
    console.error("[admin/contact-messages] update failed:", updated.error);
    return NextResponse.json(
      { error: "Message update failed." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, message: updated.data });
}
