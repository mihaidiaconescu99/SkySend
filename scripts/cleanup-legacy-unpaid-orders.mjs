import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

const execute = process.argv.includes("--execute");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and STRIPE_SECRET_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stripe = new Stripe(stripeSecretKey);
const { data: candidates, error } = await supabase
  .from("orders")
  .select("id,local_order_id,stripe_payment_intent_id")
  .is("paid_at", null)
  .in("payment_status", ["pending", "failed"])
  .is("stripe_charge_id", null)
  .order("created_at");

if (error) throw new Error(error.message);
const safeOrderIds = [];
const skippedCaptured = [];
const cancellationFailures = [];

for (const order of candidates ?? []) {
  if (!order.stripe_payment_intent_id) {
    safeOrderIds.push(order.id);
    continue;
  }
  try {
    const intent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    if (intent.status === "succeeded" || intent.amount_received > 0) {
      skippedCaptured.push(order.local_order_id);
      continue;
    }
    if (execute && intent.status !== "canceled") {
      await stripe.paymentIntents.cancel(intent.id);
    }
    safeOrderIds.push(order.id);
  } catch (caught) {
    cancellationFailures.push({
      order: order.local_order_id,
      error: caught instanceof Error ? caught.message : "stripe_lookup_failed",
    });
  }
}

if (!execute) {
  console.log(JSON.stringify({
    mode: "dry-run",
    candidates: candidates?.length ?? 0,
    safeToDeleteAfterCancellation: safeOrderIds.length,
    skippedCaptured,
    cancellationFailures,
    run: "npm run cleanup:legacy-unpaid -- --execute",
  }, null, 2));
  process.exit(0);
}

if (cancellationFailures.length) {
  throw new Error(`Cleanup stopped: ${cancellationFailures.length} Stripe intents could not be verified or cancelled.`);
}

const { data: deleted, error: cleanupError } = safeOrderIds.length
  ? await supabase.rpc("cleanup_legacy_unpaid_orders", { p_order_ids: safeOrderIds })
  : { data: 0, error: null };
if (cleanupError) throw new Error(cleanupError.message);
console.log(JSON.stringify({
  mode: "execute",
  candidates: candidates?.length ?? 0,
  deleted: Number(deleted ?? 0),
  skippedCaptured,
}, null, 2));
