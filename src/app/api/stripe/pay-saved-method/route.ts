import { NextResponse } from "next/server";
import {
  assertStripePaymentMethodBelongsToCustomer,
  createStripePaymentIntentParams,
  getAuthenticatedStripeCustomer,
  StripeAuthenticationError,
} from "@/lib/stripe/server";
import { isValidPricingSnapshot } from "@/lib/pricing";
import type { SkySendPricingResult } from "@/types/pricing";
import type { StripePaymentIntentDraft } from "@/types/stripe";

type SavedMethodPaymentRequestBody = {
  orderId?: string;
  paymentMethodId?: string;
  pricingSnapshot?: SkySendPricingResult;
};

function createSavedPaymentIdempotencyKey(
  orderId: string,
  paymentMethodId: string,
  amountMinor: number,
  currency: string,
) {
  return `skysend-saved-${orderId}-${paymentMethodId}-${amountMinor}-${currency.toLowerCase()}`.slice(
    0,
    255,
  );
}

export async function POST(request: Request) {
  let body: SavedMethodPaymentRequestBody;

  try {
    body = (await request.json()) as SavedMethodPaymentRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid saved payment request." },
      { status: 400 },
    );
  }

  if (
    !body.orderId ||
    !body.paymentMethodId ||
    !isValidPricingSnapshot(body.pricingSnapshot)
  ) {
    return NextResponse.json(
      { error: "Comanda pricing or payment method is not valid for checkout." },
      { status: 400 },
    );
  }

  const amountMinor = body.pricingSnapshot.total.amountMinor;
  const currency = body.pricingSnapshot.total.currency;

  try {
    const { stripe, customer, clerkUserId } = await getAuthenticatedStripeCustomer();
    await assertStripePaymentMethodBelongsToCustomer(
      stripe,
      customer.id,
      body.paymentMethodId,
    );

    const draft: StripePaymentIntentDraft = {
      amountMinor,
      currency,
      customerProfileId: clerkUserId,
      stripeCustomerId: customer.id,
      orderId: body.orderId,
      metadata: {
        orderId: body.orderId,
        product: "skysend_delivery",
        environment: "test",
        paymentSurface: "saved_method",
      },
      statementDescriptorSuffix: "SKYSEND",
    };
    const paymentIntent = await stripe.paymentIntents.create(
      {
        ...createStripePaymentIntentParams(draft),
        confirm: true,
        description: `SkySend delivery ${body.orderId}`,
        payment_method: body.paymentMethodId,
        return_url: `${new URL(request.url).origin}/client/checkout/${body.orderId}?payment=return`,
        use_stripe_sdk: true,
      },
      {
        idempotencyKey: createSavedPaymentIdempotencyKey(
          body.orderId,
          body.paymentMethodId,
          amountMinor,
          currency,
        ),
      },
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });
  } catch (error) {
    if (error instanceof StripeAuthenticationError) {
      return NextResponse.json(
        { error: "Authentication is required for checkout." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Stripe saved payment could not be completed. Please retry." },
      { status: 502 },
    );
  }
}
