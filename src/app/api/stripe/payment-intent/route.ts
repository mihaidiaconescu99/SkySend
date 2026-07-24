import { auth } from "@clerk/nextjs/server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { validateRequest } from "@/lib/api/validation";
import {
  createStripePaymentIntentParams,
  getAuthenticatedStripeCustomer,
  getStripeServer,
  listStripeCustomerPaymentMethods,
  StripeAuthenticationError,
} from "@/lib/stripe/server";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { assertOperationsAvailable } from "@/lib/operational-status-server";
import { reconcilePaidCheckoutSession } from "@/lib/stripe/webhook-server";
import type { StripePaymentIntentDraft } from "@/types/stripe";
import {
  paymentIntentRequestSchema,
  stripePaymentIntentIdSchema,
} from "@/lib/stripe/input-schemas";

function idempotencyKey(sessionId: string, amount: number, currency: string) {
  return `skysend-checkout-${sessionId}-${amount}-${currency.toLowerCase()}`.slice(0, 255);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication is required for checkout." }, { status: 401 });
  const parsed = await validateRequest(paymentIntentRequestSchema, request, {
    maxBytes: 4 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = createAdminSupabaseClient();
    const db = supabase as any;
    await assertOperationsAvailable(supabase);
    const profile = await new ProfilesRepository(supabase).getByClerkUserId(userId);
    if (!profile.ok || !profile.data) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    const { data: session } = await db.from("delivery_checkout_sessions").select("*")
      .eq("id", parsed.data.checkoutSessionId).eq("profile_id", profile.data.id).maybeSingle();
    if (!session) return NextResponse.json({ error: "Checkout session not found." }, { status: 404 });
    if (!["active", "payment_processing"].includes(session.status) || Date.parse(session.expires_at) <= Date.now()) {
      return NextResponse.json({ error: "checkout_expired" }, { status: 409 });
    }
    if (!session.billing_data || !session.privacy_acknowledged_at) {
      return NextResponse.json({ error: "Billing details are required." }, { status: 409 });
    }
    const { stripe, customer, clerkUserId } = await getAuthenticatedStripeCustomer();
    let intent = session.stripe_payment_intent_id
      ? await stripe.paymentIntents.retrieve(session.stripe_payment_intent_id)
      : null;
    if (intent && intent.status === "succeeded") {
      try {
        await reconcilePaidCheckoutSession(session.id, new URL(request.url).origin);
      } catch (error) {
        console.error("[payment-intent] paid checkout reconciliation", session.id, error);
      }
      return NextResponse.json({
        paymentIntentId: intent.id,
        status: intent.status,
      });
    }
    if (intent) {
      intent = await stripe.paymentIntents.update(intent.id, {
        setup_future_usage: parsed.data.savePaymentMethod ? "off_session" : "",
      });
    } else {
      const draft: StripePaymentIntentDraft = {
        amountMinor: session.total_amount_minor,
        currency: session.currency,
        customerProfileId: clerkUserId,
        stripeCustomerId: customer.id,
        orderId: session.local_order_id,
        saveForFutureUse: parsed.data.savePaymentMethod,
        metadata: {
          checkoutSessionId: session.id,
          product: "skysend_delivery",
          environment: process.env.NODE_ENV ?? "development",
        },
        statementDescriptorSuffix: "SKYSEND",
      };
      intent = await stripe.paymentIntents.create({
        ...createStripePaymentIntentParams(draft),
        description: `SkySend delivery ${session.local_order_id}`,
      }, { idempotencyKey: idempotencyKey(session.id, session.total_amount_minor, session.currency) });
    }
    await db.from("delivery_checkout_sessions").update({
      stripe_payment_intent_id: intent.id,
      stripe_customer_id: customer.id,
      save_payment_method: parsed.data.savePaymentMethod,
      status: "payment_processing",
      current_step: "payment",
    }).eq("id", session.id);
    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      savedPaymentMethods: await listStripeCustomerPaymentMethods(stripe, customer).catch(() => []),
      selectedPaymentMethodId: session.selected_payment_method_id,
      status: intent.status,
    });
  } catch (error) {
    if (error instanceof StripeAuthenticationError) return NextResponse.json({ error: "Authentication is required for checkout." }, { status: 401 });
    console.error("[payment-intent]", error);
    return NextResponse.json({ error: "Stripe payment could not be prepared. Please retry." }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const paymentIntentId = new URL(request.url).searchParams.get("paymentIntentId");
  const parsedId = stripePaymentIntentIdSchema.safeParse(paymentIntentId);
  if (!parsedId.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const { customer } = await getAuthenticatedStripeCustomer();
    const intent = await getStripeServer().paymentIntents.retrieve(parsedId.data);
    const owner = typeof intent.customer === "string" ? intent.customer : intent.customer?.id ?? null;
    if (owner !== customer.id) return NextResponse.json({ error: "Payment intent does not belong to this customer." }, { status: 403 });
    return NextResponse.json({ paymentIntentId: intent.id, status: intent.status });
  } catch {
    return NextResponse.json({ error: "Stripe payment could not be verified." }, { status: 502 });
  }
}
