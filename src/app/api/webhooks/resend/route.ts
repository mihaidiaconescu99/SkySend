import { NextResponse } from "next/server";
import { ingestResendInbound, verifyResendWebhook } from "@/lib/site-messages/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 256 * 1024) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const payload = await request.text();
  if (new TextEncoder().encode(payload).byteLength > 256 * 1024) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  try {
    const event = verifyResendWebhook(payload, request.headers);
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
