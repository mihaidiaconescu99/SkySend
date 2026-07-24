import { describe, expect, it } from "vitest";

import {
  isAllowedFulfillmentTransition,
  updateOrderStatusBodySchema,
} from "@/lib/orders/status-input";

describe("order status input", () => {
  it("accepts a normal forward transition payload", () => {
    expect(updateOrderStatusBodySchema.safeParse({
      orderId: "SKY-PT-12345-000",
      fulfillmentStatus: "active_mission",
      fallbackReason: null,
    }).success).toBe(true);
  });

  it("rejects client-authoritative payment fields and unsafe text", () => {
    expect(updateOrderStatusBodySchema.safeParse({
      orderId: "SKY-PT-12345-000",
      fulfillmentStatus: "completed_mission",
      paymentStatus: "paid",
    }).success).toBe(false);
    expect(updateOrderStatusBodySchema.safeParse({
      orderId: "SKY-PT-12345-000",
      fulfillmentStatus: "failed_mission",
      fallbackReason: "<img src=x onerror=alert(1)>",
    }).success).toBe(false);
  });

  it("rejects missing, nullable, or inconsistent state updates", () => {
    expect(updateOrderStatusBodySchema.safeParse({
      orderId: "SKY-PT-12345-000",
    }).success).toBe(false);
    expect(updateOrderStatusBodySchema.safeParse({
      orderId: "SKY-PT-12345-000",
      fulfillmentStatus: null,
    }).success).toBe(false);
    expect(updateOrderStatusBodySchema.safeParse({
      orderId: "SKY-PT-12345-000",
      fulfillmentStatus: "active_mission",
      fallbackReason: "Eșec inventat",
    }).success).toBe(false);
  });

  it("allows duplicates idempotently and rejects impossible transitions", () => {
    expect(isAllowedFulfillmentTransition("active_mission", "active_mission"))
      .toBe(true);
    expect(isAllowedFulfillmentTransition("order_created", "active_mission"))
      .toBe(true);
    expect(isAllowedFulfillmentTransition("completed_mission", "active_mission"))
      .toBe(false);
    expect(isAllowedFulfillmentTransition("failed_mission", "completed_mission"))
      .toBe(false);
  });
});
