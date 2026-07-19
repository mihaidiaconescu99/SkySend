import type { StripeTestCard } from "@/types/stripe";

export const stripeTestCards: StripeTestCard[] = [
  {
    id: "visa-4242",
    label: "Visa card",
    brand: "Visa",
    last4: "4242",
    expiryLabel: "04/34",
    behaviorLabel: "Accepted",
    description: "Primary Visa card profile for secure checkout.",
  },
  {
    id: "mastercard-4444",
    label: "Mastercard card",
    brand: "Mastercard",
    last4: "4444",
    expiryLabel: "06/35",
    behaviorLabel: "Accepted",
    description: "Useful for showing multiple saved payment methods.",
  },
  {
    id: "insufficient-funds-9995",
    label: "Verificare required card",
    brand: "Visa",
    last4: "9995",
    expiryLabel: "08/34",
    behaviorLabel: "Plată unavailable",
    description: "Reserved for payment review and recovery flows.",
  },
  {
    id: "requires-authentication-3184",
    label: "Authentication required card",
    brand: "Visa",
    last4: "3184",
    expiryLabel: "10/35",
    behaviorLabel: "Requires authentication",
    description: "Used when checkout requires extra cardholder authentication.",
  },
] as const;
