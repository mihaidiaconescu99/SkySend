import { NextResponse } from "next/server";
import { readLimitedTextRequest } from "@/lib/api/validation";
import { getStripeServer } from "@/lib/stripe/server";
import { processStripeEvent } from "@/lib/stripe/webhook-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "webhook_not_configured" }, { status: 503 });
  const rawBody = await readLimitedTextRequest(request, {
    maxBytes: 256 * 1024,
  });
  if (!rawBody.ok) return rawBody.response;
  let event;
  try {
    event = getStripeServer().webhooks.constructEvent(rawBody.data, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  try {
    await processStripeEvent(event, new URL(request.url).origin);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe-webhook] processing failed", error);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

