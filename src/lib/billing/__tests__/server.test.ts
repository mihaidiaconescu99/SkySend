import { describe, expect, it } from "vitest";
import { buildInvoiceLineItems } from "@/lib/billing/server";
import type { PricingSnapshot } from "@/types/order";

describe("buildInvoiceLineItems", () => {
  it("repairs historical snapshots that duplicated the configuration adjustment", () => {
    const pricing: PricingSnapshot = {
      version: "skysend-pricing-v1",
      baseFee: 1_490,
      distanceFee: 420,
      configMultiplier: 1,
      dispatchAdjustment: 0,
      surcharges: [
        { type: "fragile_handling", amount: 650, label: "Manipulare fragilă" },
        { type: "drone_model", amount: 170, label: "Model dronă" },
        { type: "delivery_config", amount: 170, label: "Configurație cargo" },
      ],
      subtotal: 2_080,
      total: 2_730,
    };

    const items = buildInvoiceLineItems(pricing);

    expect(items.some((item) => item.code === "drone_model")).toBe(false);
    expect(items.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(
      pricing.total,
    );
  });
});
