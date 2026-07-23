import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertStripePaymentMethodBelongsToCustomer,
  getAuthenticatedStripeCustomer,
  StripeAuthenticationError,
} from "@/lib/stripe/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { assertOperationsAvailable } from "@/lib/operational-status-server";

/* eslint-disable @typescript-eslint/no-explicit-any */
const schema = z.object({
  checkoutSessionId: z.string().uuid(),
  paymentIntentId: z.string().min(1),
  paymentMethodId: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid saved payment request." }, { status: 400 });
  try {
    const supabase = createAdminSupabaseClient();
    const db = supabase as any;
    await assertOperationsAvailable(supabase);
    const { clerkUserId, stripe, customer } = await getAuthenticatedStripeCustomer();
    const profile = await new ProfilesRepository(supabase).getByClerkUserId(clerkUserId);
    if (!profile.ok || !profile.data) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    const { data: session } = await db.from("delivery_checkout_sessions").select("*")
      .eq("id", parsed.data.checkoutSessionId).eq("profile_id", profile.data.id).maybeSingle();
    if (!session || session.stripe_payment_intent_id !== parsed.data.paymentIntentId) {
      return NextResponse.json({ error: "Payment intent does not match this checkout." }, { status: 409 });
    }
    if (Date.parse(session.expires_at) <= Date.now()) return NextResponse.json({ error: "checkout_expired" }, { status: 409 });
    await assertStripePaymentMethodBelongsToCustomer(stripe, customer.id, parsed.data.paymentMethodId);
    let intent = await stripe.paymentIntents.retrieve(parsed.data.paymentIntentId);
    const owner = typeof intent.customer === "string" ? intent.customer : intent.customer?.id ?? null;
    if (owner !== customer.id || intent.metadata.checkoutSessionId !== session.id || intent.amount !== session.total_amount_minor) {
      return NextResponse.json({ error: "Payment intent does not match this checkout." }, { status: 409 });
    }
    if (["requires_payment_method", "requires_confirmation"].includes(intent.status)) {
      intent = await stripe.paymentIntents.confirm(intent.id, {
        payment_method: parsed.data.paymentMethodId,
        return_url: `${new URL(request.url).origin}/client/create-delivery?checkout=${session.id}&payment=return`,
        use_stripe_sdk: true,
      });
    }
    await db.from("delivery_checkout_sessions").update({
      selected_payment_method_id: parsed.data.paymentMethodId,
      status: "payment_processing",
    }).eq("id", session.id);
    return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id, status: intent.status });
  } catch (error) {
    if (error instanceof StripeAuthenticationError) return NextResponse.json({ error: "Authentication is required for checkout." }, { status: 401 });
    console.error("[pay-saved-method]", error);
    return NextResponse.json({ error: "Stripe saved payment could not be completed. Please retry." }, { status: 502 });
  }
}
