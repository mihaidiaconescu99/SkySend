import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  localOrderIdSchema,
  publicTrackingCodeSchema,
  recipientTrackingTokenSchema,
} from "@/lib/api/input-schemas";
import { authorizeApiRequest } from "@/lib/api/role-guard";
import { publicErrorCode, validateRequest } from "@/lib/api/validation";
import { billingSnapshotSchema } from "@/lib/billing/validation";
import {
  getOwnedCheckoutSession,
  getSavedBillingProfile,
  priceCheckoutPayload,
  saveBillingProfile,
  serializeCheckoutSession,
} from "@/lib/checkout/server";
import { assertOperationsAvailable } from "@/lib/operational-status-server";
import { createDeliveryPayloadSchema } from "@/lib/delivery-input-schemas";
import { ProfilesRepository } from "@/lib/repositories/profiles-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getStripeServer } from "@/lib/stripe/server";
import { reconcilePaidCheckoutSession } from "@/lib/stripe/webhook-server";
import type { CreateDeliveryPayload } from "@/types/create-delivery";

/* eslint-disable @typescript-eslint/no-explicit-any */
const createSchema = z.object({
  payload: createDeliveryPayloadSchema,
  localOrderId: localOrderIdSchema,
  publicTrackingCode: publicTrackingCodeSchema,
  recipientTrackingToken: recipientTrackingTokenSchema,
  deliveryDraftId: z.string().uuid().nullable().optional(),
  locale: z.enum(["ro", "en"]).default("ro"),
}).strict();

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_billing"), sessionId: z.string().uuid(), billing: billingSnapshotSchema, saveForFuture: z.boolean() }).strict(),
  z.object({ action: z.literal("set_step"), sessionId: z.string().uuid(), step: z.enum(["summary", "billing", "payment"]) }).strict(),
  z.object({ action: z.literal("select_payment_method"), sessionId: z.string().uuid(), paymentMethodId: z.string().trim().regex(/^pm_[A-Za-z0-9_]+$/u).max(255).nullable() }).strict(),
  z.object({ action: z.literal("cancel"), sessionId: z.string().uuid() }).strict(),
]);

async function actor() {
  const { userId } = await auth();
  if (!userId) return null;
  const supabase = createAdminSupabaseClient();
  const profile = await new ProfilesRepository(supabase).getByClerkUserId(userId);
  if (!profile.ok || !profile.data) return null;
  return { supabase, profile: profile.data, db: supabase as any };
}

async function cancelIntent(paymentIntentId?: string | null) {
  if (!paymentIntentId) return "none" as const;
  try {
    const stripe = getStripeServer();
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status === "succeeded") return "captured" as const;
    if (intent.status === "canceled") return "cancelled" as const;
    await stripe.paymentIntents.cancel(intent.id);
    return "cancelled" as const;
  } catch (error) {
    console.error("[delivery-checkout] payment intent cancellation", error);
    return "unavailable" as const;
  }
}

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const context = await actor();
  if (!context) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  let row = await getOwnedCheckoutSession(context.supabase, context.profile.id, sessionId);
  if (row && ["active", "payment_processing"].includes(row.status) && Date.parse(row.expires_at) <= Date.now()) {
    const cancellation = await cancelIntent(row.stripe_payment_intent_id);
    if (cancellation === "captured") {
      const { data } = await context.db.from("delivery_checkout_sessions")
        .update({ status: "finalization_failed", last_error: "captured_awaiting_finalization" })
        .eq("id", row.id).eq("profile_id", context.profile.id)
        .select("*,order:orders(local_order_id)").single();
      row = data;
    } else if (cancellation !== "unavailable") {
      const { data } = await context.db.from("delivery_checkout_sessions")
        .update({ status: "expired", current_step: "summary", privacy_acknowledged_at: null }).eq("id", row.id)
        .eq("profile_id", context.profile.id).select("*,order:orders(local_order_id)").single();
      row = data;
    }
  }
  if (
    row?.stripe_payment_intent_id &&
    ["payment_processing", "finalizing", "finalization_failed"].includes(row.status)
  ) {
    try {
      await reconcilePaidCheckoutSession(row.id, new URL(request.url).origin);
    } catch (error) {
      console.error("[delivery-checkout] paid session reconciliation", row.id, error);
    }
    row = await getOwnedCheckoutSession(
      context.supabase,
      context.profile.id,
      row.id,
    );
  }
  const saved = await getSavedBillingProfile(context.supabase, context.profile.id);
  return NextResponse.json({
    session: row ? serializeCheckoutSession(row, saved) : null,
    savedBillingProfile: saved,
  });
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const context = await actor();
  if (!context) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(createSchema, request, {
    maxBytes: 256 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  try {
    await assertOperationsAvailable(context.supabase);
    const { data: reusable } = await context.db.from("delivery_checkout_sessions")
      .select("*")
      .eq("profile_id", context.profile.id)
      .eq("local_order_id", parsed.data.localOrderId)
      .maybeSingle();
    if (reusable?.status === "finalized") {
      return NextResponse.json({ error: "checkout_already_finalized" }, { status: 409 });
    }
    const active = await getOwnedCheckoutSession(context.supabase, context.profile.id);
    if (active && active.id !== reusable?.id) {
      const cancellation = await cancelIntent(active.stripe_payment_intent_id);
      if (cancellation === "captured") return NextResponse.json({ error: "payment_finalizing" }, { status: 409 });
      if (cancellation === "unavailable") return NextResponse.json({ error: "stripe_intent_unavailable" }, { status: 503 });
      await context.db.from("delivery_checkout_sessions").update({ status: "cancelled" })
        .eq("id", active.id).eq("profile_id", context.profile.id);
    }
    if (reusable) {
      const cancellation = await cancelIntent(reusable.stripe_payment_intent_id);
      if (cancellation === "captured") return NextResponse.json({ error: "payment_finalizing" }, { status: 409 });
      if (cancellation === "unavailable") return NextResponse.json({ error: "stripe_intent_unavailable" }, { status: 503 });
    }
    const trustedPayload = {
      ...parsed.data.payload,
      userId: context.profile.clerkUserId,
    } as unknown as CreateDeliveryPayload;
    const priced = await priceCheckoutPayload(context.supabase, trustedPayload);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const checkoutRow = {
      profile_id: context.profile.id,
      delivery_draft_id: parsed.data.deliveryDraftId ?? null,
      local_order_id: reusable?.local_order_id ?? parsed.data.localOrderId,
      public_tracking_code: reusable?.public_tracking_code ?? parsed.data.publicTrackingCode,
      recipient_tracking_token: reusable?.recipient_tracking_token ?? parsed.data.recipientTrackingToken,
      payload: priced.payload,
      pricing_result: priced.pricing,
      order_pricing_snapshot: priced.orderPricingSnapshot,
      handoff_points_snapshot: priced.handoffPointsSnapshot,
      selected_pickup_handoff_point: priced.selectedPickupHandoffPoint,
      selected_dropoff_handoff_point: priced.selectedDropoffHandoffPoint,
      total_amount_minor: priced.pricing.total.amountMinor,
      currency: priced.pricing.currency,
      locale: parsed.data.locale,
      current_step: "billing",
      status: "active",
      expires_at: expiresAt,
      privacy_acknowledged_at: null,
      stripe_customer_id: null,
      stripe_payment_intent_id: null,
      selected_payment_method_id: null,
      save_payment_method: false,
      paid_at: null,
      dispatch_starts_at: null,
      order_id: null,
      last_error: null,
    };
    const mutation = reusable
      ? context.db.from("delivery_checkout_sessions").update(checkoutRow).eq("id", reusable.id)
      : context.db.from("delivery_checkout_sessions").insert(checkoutRow);
    const { data, error } = await mutation.select("*,order:orders(local_order_id)").single();
    if (error) throw new Error(error.message);
    const saved = await getSavedBillingProfile(context.supabase, context.profile.id);
    return NextResponse.json({ session: serializeCheckoutSession(data, saved), pricing: priced.pricing });
  } catch (error) {
    const message = publicErrorCode(
      error,
      [
        "operations_maintenance",
        "operations_suspended",
        "operational_pricing_unavailable",
        "delivery_points_required",
      ] as const,
      "checkout_create_failed",
    );
    const status = message.startsWith("operations_") ? 423 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request) {
  const authorization = await authorizeApiRequest(["client"]);
  if (!authorization.ok) return authorization.response;
  const context = await actor();
  if (!context) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const parsed = await validateRequest(patchSchema, request, {
    maxBytes: 24 * 1024,
  });
  if (!parsed.ok) return parsed.response;
  const row = await getOwnedCheckoutSession(context.supabase, context.profile.id, parsed.data.sessionId);
  if (!row) return NextResponse.json({ error: "checkout_not_found" }, { status: 404 });
  if (row.status === "finalized") {
    const saved = await getSavedBillingProfile(context.supabase, context.profile.id);
    return NextResponse.json({ session: serializeCheckoutSession(row, saved) });
  }
  if (["finalizing", "finalization_failed", "cancelled"].includes(row.status)) {
    return NextResponse.json({ error: "checkout_locked" }, { status: 409 });
  }
  if (Date.parse(row.expires_at) <= Date.now()) {
    const cancellation = await cancelIntent(row.stripe_payment_intent_id);
    if (cancellation === "captured") {
      await context.db.from("delivery_checkout_sessions").update({ status: "finalization_failed", last_error: "captured_awaiting_finalization" }).eq("id", row.id);
      return NextResponse.json({ error: "payment_finalizing" }, { status: 409 });
    }
    if (cancellation === "unavailable") return NextResponse.json({ error: "stripe_intent_unavailable" }, { status: 503 });
    await context.db.from("delivery_checkout_sessions").update({ status: "expired", current_step: "summary", privacy_acknowledged_at: null }).eq("id", row.id);
    return NextResponse.json({ error: "checkout_expired" }, { status: 409 });
  }

  let update: Record<string, unknown> = {};
  if (parsed.data.action === "save_billing") {
    update = {
      billing_data: parsed.data.billing,
      privacy_acknowledged_at: new Date().toISOString(),
      current_step: "payment",
    };
    if (parsed.data.saveForFuture) {
      await saveBillingProfile(context.supabase, context.profile.id, parsed.data.billing);
    }
  } else if (parsed.data.action === "set_step") {
    update = { current_step: parsed.data.step };
  } else if (parsed.data.action === "select_payment_method") {
    update = { selected_payment_method_id: parsed.data.paymentMethodId };
  } else {
    const cancellation = await cancelIntent(row.stripe_payment_intent_id);
    if (cancellation === "captured") return NextResponse.json({ error: "payment_finalizing" }, { status: 409 });
    if (cancellation === "unavailable") return NextResponse.json({ error: "stripe_intent_unavailable" }, { status: 503 });
    update = { status: "cancelled", current_step: "summary" };
  }
  const { data, error } = await context.db.from("delivery_checkout_sessions").update(update)
    .eq("id", row.id).eq("profile_id", context.profile.id)
    .select("*,order:orders(local_order_id)").single();
  if (error) {
    console.error("[delivery-checkout] update failed", error);
    return NextResponse.json({ error: "checkout_update_failed" }, { status: 502 });
  }
  const saved = await getSavedBillingProfile(context.supabase, context.profile.id);
  return NextResponse.json({ session: serializeCheckoutSession(data, saved) });
}
