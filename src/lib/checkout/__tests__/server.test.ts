import { describe, expect, it, vi } from "vitest";
import {
  getOwnedCheckoutSession,
  toOrderPricingSnapshot,
} from "@/lib/checkout/server";
import { calculateSkySendPricing } from "@/lib/pricing";
import { deliveryConfigurations } from "@/constants/delivery-configurations";

function checkoutQuery() {
  const selectedStatuses: string[][] = [];
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn((_column: string, statuses: string[]) => {
      selectedStatuses.push(statuses);
      return query;
    }),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
  };
  return {
    client: { from: vi.fn(() => query) },
    selectedStatuses,
  };
}

describe("getOwnedCheckoutSession", () => {
  it("can exclude failed finalizations when looking for a session to replace", async () => {
    const { client, selectedStatuses } = checkoutQuery();

    await getOwnedCheckoutSession(
      client as never,
      "profile_test",
      null,
      { includeFinalizationFailed: false },
    );

    expect(selectedStatuses).toEqual([
      ["active", "payment_processing", "finalizing"],
    ]);
  });

  it("still restores failed finalizations for reconciliation by default", async () => {
    const { client, selectedStatuses } = checkoutQuery();

    await getOwnedCheckoutSession(client as never, "profile_test");

    expect(selectedStatuses[0]).toContain("finalization_failed");
  });
});

describe("toOrderPricingSnapshot", () => {
  it("includes a configured route adjustment exactly once in invoice line items", () => {
    const configuration = deliveryConfigurations[0];
    const pricing = calculateSkySendPricing({
      distanceKm: 4,
      selectedDroneId: configuration.mappedDroneClass,
      deliveryConfiguration: configuration,
      dispatchTiming: "standard",
      fragilityLevel: "low",
    });

    const snapshot = toOrderPricingSnapshot(pricing);
    const lineTotal =
      snapshot.baseFee +
      snapshot.distanceFee +
      snapshot.dispatchAdjustment +
      (snapshot.scheduledAdjustment ?? 0) +
      snapshot.surcharges.reduce((sum, surcharge) => sum + surcharge.amount, 0);

    expect(snapshot.surcharges.filter((item) =>
      item.type === "delivery_config" || item.type === "drone_model"
    )).toHaveLength(1);
    expect(lineTotal).toBe(snapshot.total);
  });
});
