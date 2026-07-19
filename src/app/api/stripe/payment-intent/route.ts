import { NextResponse } from "next/server";
import {
  createStripePaymentIntentParams,
  getAuthenticatedStripeCustomer,
  getStripeServer,
  listStripeCustomerPaymentMethods,
  StripeAuthenticationError,
} from "@/lib/stripe/server";
import { isValidPricingSnapshot } from "@/lib/pricing";
import type { SkySendPricingResult } from "@/types/pricing";
import type { StripePaymentIntentDraft } from "@/types/stripe";

type PaymentIntentRequestBody = {
  orderId?: string;
  customerProfileId?: string | null;
  description?: string;
  pricingSnapshot?: SkySendPricingResult;
  savePaymentMethod?: boolean;
};

function createPaymentIdempotencyKey(
  orderId: string,
  amountMinor: number,
  currency: string,
) {
  return `skysend-payment-${orderId}-${amountMinor}-${currency.toLowerCase()}`.slice(
    0,
    255,
  );
}

export async function POST(request: Request) {
  let body: PaymentIntentRequestBody;

  try {
    body = (await request.json()) as PaymentIntentRequestBody;
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

  const draft: StripePaymentIntentDraft = {
    amountMinor,
    currency,
    customerProfileId: body.customerProfileId ?? "stripe-customer",
    orderId: body.orderId,
    saveForFutureUse: body.savePaymentMethod ?? true,
    metadata: {
      orderId: body.orderId,
      product: "skysend_delivery",
      environment: "test",
    },
    statementDescriptorSuffix: "SKYSEND",
  };
  let paymentIntent;

  try {
    const { stripe, customer, clerkUserId } = await getAuthenticatedStripeCustomer();
    const savedPaymentMethods = await listStripeCustomerPaymentMethods(
      stripe,
      customer,
    ).catch(() => []);
    draft.customerProfileId = clerkUserId;
    draft.stripeCustomerId = customer.id;
    paymentIntent = await stripe.paymentIntents.create({
      ...createStripePaymentIntentParams(draft),
      description: body.description ?? `SkySend delivery ${body.orderId}`,
    }, {
      idempotencyKey: createPaymentIdempotencyKey(
        body.orderId,
        amountMinor,
        currency,
      ),
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      savedPaymentMethods,
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
      { error: "Stripe payment could not be prepared. Please retry." },
      { status: 502 },
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentIntentId = searchParams.get("paymentIntentId");

  if (!paymentIntentId) {
    return NextResponse.json(
      { error: "Plată intent id is required." },
      { status: 400 },
    );
  }

  try {
    const { customer } = await getAuthenticatedStripeCustomer();
    const stripe = getStripeServer();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const paymentCustomerId =
      typeof paymentIntent.customer === "string"
        ? paymentIntent.customer
        : paymentIntent.customer?.id ?? null;

    if (paymentCustomerId !== customer.id) {
      return NextResponse.json(
        { error: "Plată intent does not belong to this customer." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    });
  } catch {
    return NextResponse.json(
      { error: "Stripe payment could not be verified." },
      { status: 502 },
    );
  }
}
