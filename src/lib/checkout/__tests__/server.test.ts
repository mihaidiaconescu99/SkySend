import { describe, expect, it, vi } from "vitest";
import { getOwnedCheckoutSession } from "@/lib/checkout/server";

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
