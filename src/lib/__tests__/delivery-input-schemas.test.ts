import { describe, expect, it } from "vitest";

import { checkoutDeliveryPayloadSchema } from "@/lib/delivery-input-schemas";

describe("checkoutDeliveryPayloadSchema", () => {
  it("does not accept server-authoritative identity or price fields", () => {
    expect(checkoutDeliveryPayloadSchema.shape).not.toHaveProperty("userId");
    expect(checkoutDeliveryPayloadSchema.shape).not.toHaveProperty(
      "estimatedPrice",
    );
    expect(checkoutDeliveryPayloadSchema.shape).not.toHaveProperty(
      "pricingSnapshot",
    );
  });
});
