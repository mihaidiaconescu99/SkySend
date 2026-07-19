import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe/server";
import { isValidPricingSnapshot } from "@/lib/pricing";
import type { SkySendPricingResult } from "@/types/pricing";

type CheckoutSessionRequestBody = {
  orderId?: string;
  description?: string;
  pricingSnapshot?: SkySendPricingResult;
};

export async function POST(request: Request) {
  let body: CheckoutSessionRequestBody;

  try {
    body = (await request.json()) as CheckoutSessionRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid checkout request." },
      { status: 400 },
    );
  }

  if (!body.orderId || !isValidPricingSnapshot(body.pricingSnapshot)) {
    return NextResponse.json(
      { error: "Comanda pricing is not valid for checkout." },
      { status: 400 },
    );
  }
  const amountMinor = body.pricingSnapshot.total.amountMinor;
  const currency = body.pricingSnapshot.total.currency;

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  try {
    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/client/checkout/${body.orderId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/client/checkout/${body.orderId}?checkout=cancelled`,
      client_reference_id: body.orderId,
      metadata: {
        orderId: body.orderId,
        product: "skysend_delivery",
        environment: "test",
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: currency.toLowerCase(),
            unit_amount: amountMinor,
            product_data: {
              name: `SkySend delivery ${body.orderId}`,
              description: body.description ?? "Pitesti drone delivery mission",
            },
          },
        },
      ],
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch {
    return NextResponse.json(
      { error: "Secure checkout could not be prepared. Please retry." },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing secure checkout session id." },
      { status: 400 },
    );
  }

  try {
    const stripe = getStripeServer();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      sessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
      orderId: session.client_reference_id ?? session.metadata?.orderId ?? null,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Secure checkout session could not be verified." },
      { status: 502 },
    );
  }
}
