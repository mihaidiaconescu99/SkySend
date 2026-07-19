"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { getStripeRuntimeConfig } from "@/lib/stripe/shared";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripeClientConfig() {
  return getStripeRuntimeConfig();
}

export function getStripeJs() {
  const { publishableKey } = getStripeClientConfig();

  stripePromise ??= loadStripe(publishableKey);

  return stripePromise;
}
