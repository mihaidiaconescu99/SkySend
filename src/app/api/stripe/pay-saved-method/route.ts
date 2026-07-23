import { NextResponse } from "next/server";
import {
  assertStripePaymentMethodBelongsToCustomer,
  getAuthenticatedStripeCustomer,
  StripeAuthenticationError,
} from "@/lib/stripe/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { assertOperationsAvailable } from "@/lib/operational-status-server";
import { findOwnedOrder, getBillingSnapshotForOrder } from "@/lib/billing/server";

type SavedMethodPaymentRequestBody = {
  orderId?: string;
  paymentIntentId?: string;
  paymentMethodId?: string;
};

function createSavedPaymentConfirmationIdempotencyKey(
  orderId: string,
  paymentMethodId: string,
  amountMinor: number,
  currency: string,
) {
  return `skysend-confirm-saved-${orderId}-${paymentMethodId}-${amountMinor}-${currency.toLowerCase()}`.slice(
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
    !body.paymentIntentId ||
    !body.paymentMethodId
  ) {
    return NextResponse.json(
      { error: "Comanda pricing or payment method is not valid for checkout." },
      { status: 400 },
    );
  }

  try {
    const supabase = createAdminSupabaseClient();
    await assertOperationsAvailable(supabase);
    const { clerkUserId, stripe, customer } = await getAuthenticatedStripeCustomer();
    const profile = await new ProfilesRepository(supabase).getByClerkUserId(clerkUserId);
    if (!profile.ok || !profile.data) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }
    const order = await findOwnedOrder(supabase, profile.data.id, body.orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (!(await getBillingSnapshotForOrder(supabase, order.id))) {
      return NextResponse.json({ error: "Billing details are required." }, { status: 409 });
    }
    if (order.stripe_payment_intent_id !== body.paymentIntentId) {
      return NextResponse.json({ error: "Payment intent does not match this order." }, { status: 409 });
    }
    const amountMinor = order.total_amount_minor;
    const currency = order.currency;
    await assertStripePaymentMethodBelongsToCustomer(
      stripe,
      customer.id,
      body.paymentMethodId,
    );

    let paymentIntent = await stripe.paymentIntents.retrieve(body.paymentIntentId);
    const paymentCustomerId =
      typeof paymentIntent.customer === "string"
        ? paymentIntent.customer
        : paymentIntent.customer?.id ?? null;

    if (
      paymentCustomerId !== customer.id ||
      paymentIntent.metadata.orderId !== body.orderId ||
      paymentIntent.amount !== amountMinor ||
      paymentIntent.currency.toLowerCase() !== currency.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Payment intent does not match this order." },
        { status: 409 },
      );
    }

    if (
      paymentIntent.status === "requires_payment_method" ||
      paymentIntent.status === "requires_confirmation"
    ) {
      paymentIntent = await stripe.paymentIntents.confirm(
        paymentIntent.id,
        {
          payment_method: body.paymentMethodId,
          return_url: `${new URL(request.url).origin}/client/checkout/${body.orderId}?payment=return`,
          use_stripe_sdk: true,
        },
        {
            idempotencyKey: createSavedPaymentConfirmationIdempotencyKey(
            body.orderId,
            body.paymentMethodId,
            amountMinor,
            currency,
          ),
        },
      );
    }

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
