import { NextResponse } from "next/server";
import {
  assertStripePaymentMethodBelongsToCustomer,
  getAuthenticatedStripeCustomer,
  listStripeCustomerPaymentMethods,
  StripeAuthenticationError,
} from "@/lib/stripe/server";

type PaymentMethodMutationBody = {
  paymentMethodId?: string;
};

async function readMutationBody(request: Request) {
  try {
    return (await request.json()) as PaymentMethodMutationBody;
  } catch {
    return null;
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

export async function PATCH(request: Request) {
  const body = await readMutationBody(request);

  if (!body?.paymentMethodId) {
    return NextResponse.json(
      { error: "Metodă de plată id is required." },
      { status: 400 },
    );
  }

  try {
    const { stripe, customer } = await getAuthenticatedStripeCustomer();
    await assertStripePaymentMethodBelongsToCustomer(
      stripe,
      customer.id,
      body.paymentMethodId,
    );
    const updatedCustomer = await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: body.paymentMethodId,
      },
    });
    const paymentMethods = await listStripeCustomerPaymentMethods(
      stripe,
      updatedCustomer,
    );

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    if (error instanceof StripeAuthenticationError) {
      return NextResponse.json(
        { error: "Authentication is required for payment methods." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Stripe default payment method could not be updated." },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  const body = await readMutationBody(request);

  if (!body?.paymentMethodId) {
    return NextResponse.json(
      { error: "Metodă de plată id is required." },
      { status: 400 },
    );
  }

  try {
    const { stripe, customer } = await getAuthenticatedStripeCustomer();
    await assertStripePaymentMethodBelongsToCustomer(
      stripe,
      customer.id,
      body.paymentMethodId,
    );
    await stripe.paymentMethods.detach(body.paymentMethodId);
    const refreshedCustomer = await stripe.customers.retrieve(customer.id);

    if (refreshedCustomer.deleted) {
      return NextResponse.json({ paymentMethods: [] });
    }

    const paymentMethods = await listStripeCustomerPaymentMethods(
      stripe,
      refreshedCustomer,
    );

    return NextResponse.json({ paymentMethods });
  } catch (error) {
    if (error instanceof StripeAuthenticationError) {
      return NextResponse.json(
        { error: "Authentication is required for payment methods." },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: "Stripe payment method could not be removed." },
      { status: 502 },
    );
  }
}
