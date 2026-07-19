import { NextResponse } from "next/server";
import {
  getAuthenticatedStripeCustomer,
  listStripeCustomerPaymentMethods,
  StripeAuthenticationError,
} from "@/lib/stripe/server";

export async function POST() {
  try {
    const { stripe, customer, clerkUserId } = await getAuthenticatedStripeCustomer();
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      usage: "off_session",
      metadata: {
        clerkUserId,
        product: "skysend",
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
    });
  } catch (error) {
    if (error instanceof StripeAuthenticationError) {
      return NextResponse.json(
        { error: "Authentication is required for payment methods." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Stripe setup could not be prepared. Please retry." },
      { status: 502 },
    );
  }
}

export async function GET() {
  try {
    const { stripe, customer } = await getAuthenticatedStripeCustomer();
    const paymentMethods = await listStripeCustomerPaymentMethods(stripe, customer);

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    if (error instanceof StripeAuthenticationError) {
      return NextResponse.json(
        { error: "Authentication is required for payment methods." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Stripe payment methods could not be loaded." },
      { status: 502 },
    );
  }
}
