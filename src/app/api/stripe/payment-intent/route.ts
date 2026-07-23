import { auth } from "@clerk/nextjs/server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { z } from "zod";
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
import { findOwnedOrder, getBillingSnapshotForOrder } from "@/lib/billing/server";
import type { StripePaymentIntentDraft } from "@/types/stripe";

const schema = z.object({ orderId: z.string().min(1), savePaymentMethod: z.boolean().default(true) });

function idempotencyKey(orderId: string, amount: number, currency: string) {
  return `skysend-payment-${orderId}-${amount}-${currency.toLowerCase()}`.slice(0, 255);
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Authentication is required for checkout." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  try {
    const supabase = createAdminSupabaseClient();
    await assertOperationsAvailable(supabase);
    const profile = await new ProfilesRepository(supabase).getByClerkUserId(userId);
    if (!profile.ok || !profile.data) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    const order = await findOwnedOrder(supabase, profile.data.id, parsed.data.orderId);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.payment_status === "paid") return NextResponse.json({ error: "Order is already paid." }, { status: 409 });
    const billing = await getBillingSnapshotForOrder(supabase, order.id);
    if (!billing) return NextResponse.json({ error: "Billing details are required." }, { status: 409 });
    const { stripe, customer, clerkUserId } = await getAuthenticatedStripeCustomer();
    const draft: StripePaymentIntentDraft = {
      amountMinor: order.total_amount_minor,
      currency: order.currency,
      customerProfileId: clerkUserId,
      stripeCustomerId: customer.id,
      orderId: order.local_order_id,
      saveForFutureUse: parsed.data.savePaymentMethod,
      metadata: { orderId: order.local_order_id, orderUuid: order.id, product: "skysend_delivery", environment: process.env.NODE_ENV ?? "development" },
      statementDescriptorSuffix: "SKYSEND",
    };
    const intent = await stripe.paymentIntents.create({
      ...createStripePaymentIntentParams(draft),
      description: `SkySend delivery ${order.local_order_id}`,
    }, { idempotencyKey: idempotencyKey(order.id, order.total_amount_minor, order.currency) });
    await (supabase as any).from("orders").update({ stripe_payment_intent_id: intent.id })
      .eq("id", order.id).is("stripe_payment_intent_id", null);
    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      savedPaymentMethods: await listStripeCustomerPaymentMethods(stripe, customer).catch(() => []),
      status: intent.status,
    });
  } catch (error) {
    if (error instanceof StripeAuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof Error && error.name === "OperationalAvailabilityError") {
      return NextResponse.json({ error: error.message }, { status: 423 });
    }
    console.error("[payment-intent]", error);
    return NextResponse.json({ error: "Stripe payment could not be prepared. Please retry." }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const paymentIntentId = new URL(request.url).searchParams.get("paymentIntentId");
  if (!paymentIntentId) return NextResponse.json({ error: "Payment intent id is required." }, { status: 400 });
  try {
    const { customer } = await getAuthenticatedStripeCustomer();
    const intent = await getStripeServer().paymentIntents.retrieve(paymentIntentId);
    const owner = typeof intent.customer === "string" ? intent.customer : intent.customer?.id ?? null;
    if (owner !== customer.id) return NextResponse.json({ error: "Payment intent does not belong to this customer." }, { status: 403 });
    return NextResponse.json({ paymentIntentId: intent.id, status: intent.status });
  } catch {
    return NextResponse.json({ error: "Stripe payment could not be verified." }, { status: 502 });
  }
}
