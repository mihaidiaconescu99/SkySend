import { stripeTestCards } from "@/constants/stripe-test-cards";
import type { StripePaymentIntentDraft, StripeRuntimeConfig } from "@/types/stripe";

const STRIPE_TEST_PUBLISHABLE_PREFIX = "pk_test_";
const STRIPE_TEST_SECRET_PREFIX = "sk_test_";
const STRIPE_PLACEHOLDER_MARKER = "_your_";

export { stripeTestCards };

export function isStripeTestPublishableKey(value: string) {
  return value.startsWith(STRIPE_TEST_PUBLISHABLE_PREFIX);
}

export function isStripeTestSecretKey(value: string) {
  return value.startsWith(STRIPE_TEST_SECRET_PREFIX);
}

export function isStripePlaceholderKey(value: string) {
  return value.includes(STRIPE_PLACEHOLDER_MARKER);
}

export function assertStripeTestPublishableKey(value: string) {
  if (!isStripeTestPublishableKey(value)) {
    throw new Error(
      "[stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must use a Stripe test key (pk_test_...).",
    );
  }

  return value;
}

export function assertStripeTestSecretKey(value: string) {
  if (!isStripeTestSecretKey(value)) {
    throw new Error(
      "[stripe] STRIPE_SECRET_KEY must use a Stripe test key (sk_test_...).",
    );
  }

  return value;
}

export function getStripeRuntimeConfig(): StripeRuntimeConfig {
  const rawPublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!rawPublishableKey) {
    throw new Error(
      "[stripe] Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY for Stripe.js.",
    );
  }

  const publishableKey = assertStripeTestPublishableKey(rawPublishableKey);

  return {
    publishableKey,
    isTestMode: true,
    isPlaceholderKey: isStripePlaceholderKey(publishableKey),
  };
}

export function toStripeCurrencyCode(currency: StripePaymentIntentDraft["currency"]) {
  return currency.toLowerCase() as Lowercase<StripePaymentIntentDraft["currency"]>;
}

export function buildStripePaymentIntentMetadata(
  draft: StripePaymentIntentDraft,
): Record<string, string> {
  return {
    customerProfileId: draft.customerProfileId,
    ...(draft.orderId ? { orderId: draft.orderId } : {}),
    ...(draft.metadata ?? {}),
  };
}
