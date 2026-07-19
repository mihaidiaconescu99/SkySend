

import "server-only";

import { NextResponse } from "next/server";
import { createSiteMessage } from "@/lib/site-messages/server";
import { publicContactSchema } from "@/lib/support/support-hub";


function badRequest(reason: string) {
  return NextResponse.json({ error: reason }, { status: 400 });
}

export async function POST(request: Request) {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return badRequest("invalid_body");
  }

  const parsed = publicContactSchema.safeParse(raw);

  if (!parsed.success) {
    return badRequest("validation_failed");
  }

  try {
    const message = await createSiteMessage(parsed.data);
    return NextResponse.json({ ok: true, message }, { status: 201 });
  } catch (error) {
    console.error("[contact-messages] support ticket insert failed:", error);
    return NextResponse.json(
      { error: "db_insert_failed" },
      { status: 502 },
    );
  }
}
