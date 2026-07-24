import { describe, expect, it } from "vitest";

import {
  paySavedMethodRequestSchema,
  paymentIntentRequestSchema,
  paymentMethodDeleteSchema,
  paymentMethodPatchSchema,
  refundBodySchema,
  stripePaymentIntentIdSchema,
  stripePaymentMethodIdSchema,
} from "@/lib/stripe/input-schemas";

const checkoutSessionId = "00000000-0000-4000-8000-000000000001";

describe("Stripe input schemas", () => {
  it("accepts the normal payment payloads", () => {
    expect(paymentIntentRequestSchema.safeParse({
      checkoutSessionId,
      savePaymentMethod: true,
    }).success).toBe(true);
    expect(paySavedMethodRequestSchema.safeParse({
      checkoutSessionId,
      paymentIntentId: "pi_123456",
      paymentMethodId: "pm_123456",
    }).success).toBe(true);
    expect(paymentMethodPatchSchema.safeParse({
      paymentMethodId: "pm_123456",
      action: "set_default",
    }).success).toBe(true);
    expect(paymentMethodDeleteSchema.safeParse({
      paymentMethodId: "pm_123456",
    }).success).toBe(true);
  });

  it("rejects unknown and client-authoritative properties", () => {
    expect(paymentIntentRequestSchema.safeParse({
      checkoutSessionId,
      savePaymentMethod: false,
      amountMinor: 1,
    }).success).toBe(false);
    expect(refundBodySchema.safeParse({
      orderId: "SKY-PT-12345-000",
      reason: "Cerere validă",
      paymentStatus: "refunded",
    }).success).toBe(false);
  });

  it.each([
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "javascript:alert(1)",
  ])("rejects unsafe refund text: %s", (reason) => {
    expect(refundBodySchema.safeParse({
      orderId: "SKY-PT-12345-000",
      reason,
    }).success).toBe(false);
  });

  it("rejects non-finite and out-of-range refund amounts", () => {
    for (const amountMinor of [Number.NaN, Number.POSITIVE_INFINITY, 0, 100_000_001]) {
      expect(refundBodySchema.safeParse({
        orderId: "SKY-PT-12345-000",
        reason: "Cerere validă",
        amountMinor,
      }).success).toBe(false);
    }
  });

  it("rejects malformed Stripe identifiers", () => {
    expect(stripePaymentIntentIdSchema.safeParse("javascript:alert(1)").success)
      .toBe(false);
    expect(stripePaymentMethodIdSchema.safeParse("not-a-method").success)
      .toBe(false);
  });
});
