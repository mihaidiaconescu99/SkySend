

import "server-only";

import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/api/validation";
import { createSiteMessage } from "@/lib/site-messages/server";
import { publicContactSchema } from "@/lib/support/support-hub";

export async function POST(request: Request) {
  const parsed = await validateRequest(publicContactSchema, request, {
    maxBytes: 16 * 1024,
  });
  if (!parsed.ok) return parsed.response;

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
