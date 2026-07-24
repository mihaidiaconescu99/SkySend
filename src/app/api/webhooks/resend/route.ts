import { NextResponse } from "next/server";
import { readLimitedTextRequest } from "@/lib/api/validation";
import { ingestResendInbound, verifyResendWebhook } from "@/lib/site-messages/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await readLimitedTextRequest(request, {
    maxBytes: 256 * 1024,
  });
  if (!rawBody.ok) return rawBody.response;
  try {
    const event = verifyResendWebhook(rawBody.data, request.headers);
    if (event.type !== "email.received") return NextResponse.json({ ok: true, ignored: true });
    const result = await ingestResendInbound(event);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "webhook_failed";
    console.error("[resend-webhook]", reason);
    return NextResponse.json(
      { error: reason.includes("webhook") ? "invalid_webhook" : "webhook_failed" },
      { status: reason.includes("webhook") ? 401 : 502 },
    );
  }
}
