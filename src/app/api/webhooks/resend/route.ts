import { NextResponse } from "next/server";
import { ingestResendInbound, verifyResendWebhook } from "@/lib/site-messages/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  try {
    const event = verifyResendWebhook(payload, request.headers);
    if (event.type !== "email.received") return NextResponse.json({ ok: true, ignored: true });
    const result = await ingestResendInbound(event);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "webhook_failed";
    console.error("[resend-webhook]", reason);
    return NextResponse.json({ error: reason }, { status: reason.includes("webhook") ? 401 : 502 });
  }
}
