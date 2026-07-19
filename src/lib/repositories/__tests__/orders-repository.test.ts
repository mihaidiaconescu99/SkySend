import { beforeEach, describe, expect, it } from "vitest";

import { OrdersRepository } from "@/lib/repositories/orders-repository";
import {
  buildOrderRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";
import type { PricingSnapshot, StoredHandoffPoint } from "@/types/order";

const COMPLEX_PRICING_SNAPSHOT: PricingSnapshot = {
  version: "skysend-pricing-v1",
  baseFee: 990,
  distanceFee: 1320,
  configMultiplier: 1.14,
  dispatchAdjustment: 266,
  scheduledAdjustment: -48,
  surcharges: [
    { type: "weight_surcharge", amount: 700, label: "Supliment greutate" },
    { type: "fragile_handling", amount: 300, label: "Manipulare fragila" },
    { type: "thermal_handling", amount: 550, label: "Protectie termica" },
  ],
  subtotal: 4078,
  total: 4078,
};

const VALID_HANDOFF_POINT: StoredHandoffPoint = {
  id: "hp-1",
  label: "Locker Republicii 1",
  location: { latitude: 44.8565, longitude: 24.8692 },
  source: "geoapify_places",
  confidence: "high",
  smartScore: 0.92,
};

const MINIMAL_INPUT = {
  localOrderId: "SKY-PT-99999",
  publicTrackingCode: "TRK-PUB",
  recipientTrackingToken: "TKN-REC",
  senderProfileId: "p-1",
  pickupAddressId: "addr-1",
  dropoffAddressId: "addr-2",
  parcelId: "parcel-1",
  dispatchTiming: "standard" as const,
  droneClass: "medium_standard",
  deliveryConfigurationId: "aer_express",
  totalAmountMinor: 2310,
  pricingSnapshot: {
    version: "skysend-pricing-v1",
    baseFee: 990,
    distanceFee: 1320,
    configMultiplier: 1,
    dispatchAdjustment: 0,
    surcharges: [],
    subtotal: 2310,
    total: 2310,
  } as PricingSnapshot,
};

let store: FakeStore;
let repo: OrdersRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  repo = new OrdersRepository(fake.client);
});

describe("OrdersRepository.getById", () => {
  it("returns the mapped Order when the row exists", async () => {
    store.seedOrder(
      buildOrderRow({
        id: "o-1",
        local_order_id: "SKY-PT-1",
        pricing_snapshot: COMPLEX_PRICING_SNAPSHOT as never,
      }),
    );
    const result = await repo.getById("o-1");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.id).toBe("o-1");
      expect(result.data.localOrderId).toBe("SKY-PT-1");
    }
  });

  it("returns data: null on miss", async () => {
    const result = await repo.getById("nope");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("OrdersRepository tracking-code lookups", () => {
  beforeEach(() => {
    store.seedOrder(
      buildOrderRow({
        id: "o-1",
        local_order_id: "SKY-PT-LOCAL",
        public_tracking_code: "TRK-PUBLIC",
        recipient_tracking_token: "TKN-RECIPIENT",
      }),
    );
  });

  it("looks up by localOrderId", async () => {
    const result = await repo.getByLocalOrderId("SKY-PT-LOCAL");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) expect(result.data.id).toBe("o-1");
  });

  it("looks up by publicTrackingCode", async () => {
    const result = await repo.getByPublicTrackingCode("TRK-PUBLIC");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) expect(result.data.id).toBe("o-1");
  });

  it("looks up by recipientTrackingToken", async () => {
    const result = await repo.getByRecipientTrackingToken("TKN-RECIPIENT");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) expect(result.data.id).toBe("o-1");
  });

  it("returns null on missing tracking code", async () => {
    const result = await repo.getByLocalOrderId("does-not-exist");
    expect(result).toEqual({ ok: true, data: null });
  });

  it("returns null for an empty tracking-code argument", async () => {
    const result = await repo.getByPublicTrackingCode("");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("OrdersRepository.create", () => {
  it("creates an order with defaults applied", async () => {
    const result = await repo.create(MINIMAL_INPUT);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.status).toBe("pending");
      expect(result.data.paymentStatus).toBe("pending");
      expect(result.data.currency).toBe("RON");
    }
  });

  it("round-trips a complex pricing_snapshot deep-equal on read-back", async () => {
    const created = await repo.create({
      ...MINIMAL_INPUT,
      totalAmountMinor: 4078,
      pricingSnapshot: COMPLEX_PRICING_SNAPSHOT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const refetched = await repo.getById(created.data.id);
    expect(refetched.ok).toBe(true);
    if (refetched.ok && refetched.data) {
      expect(refetched.data.pricingSnapshot).toEqual(COMPLEX_PRICING_SNAPSHOT);
    }
  });

  it("round-trips a complete handoff_points_snapshot deep-equal on read-back", async () => {
    const snapshot = {
      pickup: [VALID_HANDOFF_POINT, { ...VALID_HANDOFF_POINT, id: "hp-2" }],
      dropoff: [VALID_HANDOFF_POINT, { ...VALID_HANDOFF_POINT, id: "hp-3" }],
    };
    const created = await repo.create({
      ...MINIMAL_INPUT,
      handoffPointsSnapshot: snapshot,
      selectedPickupHandoffPoint: VALID_HANDOFF_POINT,
      selectedDropoffHandoffPoint: VALID_HANDOFF_POINT,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const refetched = await repo.getById(created.data.id);
    expect(refetched.ok).toBe(true);
    if (refetched.ok && refetched.data) {
      expect(refetched.data.handoffPointsSnapshot).toEqual(snapshot);
      expect(refetched.data.selectedPickupHandoffPoint).toEqual(
        VALID_HANDOFF_POINT,
      );
    }
  });

  it("rejects totalAmountMinor below the 100 floor", async () => {
    const result = await repo.create({
      ...MINIMAL_INPUT,
      totalAmountMinor: 50,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("rejects an empty publicTrackingCode", async () => {
    const result = await repo.create({
      ...MINIMAL_INPUT,
      publicTrackingCode: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("rejects an unknown dispatchTiming", async () => {
    const result = await repo.create({
      ...MINIMAL_INPUT,
      dispatchTiming: "moonwalk" as never,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});

describe("OrdersRepository.updateById", () => {
  it("applies a sparse status update", async () => {
    store.seedOrder(buildOrderRow({ id: "o-1", status: "pending" }));
    const result = await repo.updateById("o-1", { status: "in_progress" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("in_progress");
  });

  it("returns not_found for unknown id", async () => {
    const result = await repo.updateById("nope", { status: "completed" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("rejects empty input", async () => {
    store.seedOrder(buildOrderRow({ id: "o-1" }));
    const result = await repo.updateById("o-1", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});

describe("OrdersRepository.updateStatus", () => {
  it("flips status via the convenience wrapper", async () => {
    store.seedOrder(buildOrderRow({ id: "o-1", status: "pending" }));
    const result = await repo.updateStatus("o-1", "completed");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("completed");
  });

  it("does NOT impose business-logic gating (can go completed → pending)", async () => {

    store.seedOrder(buildOrderRow({ id: "o-1", status: "completed" }));
    const result = await repo.updateStatus("o-1", "pending");
    expect(result.ok).toBe(true);
  });
});

describe("OrdersRepository.updatePaymentStatus", () => {
  it("flips payment_status without touching refund_status when omitted", async () => {
    store.seedOrder(
      buildOrderRow({ id: "o-1", payment_status: "pending" }),
    );
    const result = await repo.updatePaymentStatus("o-1", "paid");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paymentStatus).toBe("paid");
      expect(result.data.refundStatus).toBeNull();
    }
  });

  it("sets refund_status when provided", async () => {
    store.seedOrder(buildOrderRow({ id: "o-1", payment_status: "paid" }));
    const result = await repo.updatePaymentStatus(
      "o-1",
      "refunded",
      "stripe_processed",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.paymentStatus).toBe("refunded");
      expect(result.data.refundStatus).toBe("stripe_processed");
    }
  });

  it("clears refund_status when null is explicitly passed", async () => {
    store.seedOrder(
      buildOrderRow({
        id: "o-1",
        payment_status: "refunded",
        refund_status: "in_progress",
      }),
    );
    const result = await repo.updatePaymentStatus("o-1", "paid", null);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.refundStatus).toBeNull();
  });
});

describe("OrdersRepository.deleteById", () => {
  it("removes the row when it exists", async () => {
    store.seedOrder(buildOrderRow({ id: "o-1" }));
    const result = await repo.deleteById("o-1");
    expect(result).toEqual({ ok: true, data: undefined });
    expect(store.orderRows.has("o-1")).toBe(false);
  });

  it("returns not_found for unknown id", async () => {
    const result = await repo.deleteById("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });
});

describe("OrdersRepository.listByProfileId", () => {
  beforeEach(() => {
    const isoFor = (day: number) =>
      `2026-05-${String(day).padStart(2, "0")}T10:00:00Z`;

    store.seedOrder(
      buildOrderRow({
        id: "o-pending-1",
        sender_profile_id: "p-1",
        status: "pending",
        created_at: isoFor(1),
      }),
    );
    store.seedOrder(
      buildOrderRow({
        id: "o-in-progress",
        sender_profile_id: "p-1",
        status: "in_progress",
        created_at: isoFor(5),
      }),
    );
    store.seedOrder(
      buildOrderRow({
        id: "o-completed",
        sender_profile_id: "p-1",
        status: "completed",
        created_at: isoFor(10),
      }),
    );
    store.seedOrder(
      buildOrderRow({
        id: "o-other",
        sender_profile_id: "p-2",
        status: "pending",
      }),
    );
  });

  it("returns all rows for the profile, newest first by default", async () => {
    const result = await repo.listByProfileId("p-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
      expect(result.data[0].id).toBe("o-completed");
    }
  });

  it("filters by a single status", async () => {
    const result = await repo.listByProfileId("p-1", { status: "completed" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("o-completed");
    }
  });

  it("filters by an array of statuses", async () => {
    const result = await repo.listByProfileId("p-1", {
      status: ["pending", "in_progress"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data.every((o) => o.status !== "completed")).toBe(true);
    }
  });

  it("returns [] without querying for an empty status[] array", async () => {
    const result = await repo.listByProfileId("p-1", { status: [] });
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("respects limit and offset", async () => {
    const result = await repo.listByProfileId("p-1", { limit: 1, offset: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe("o-in-progress");
    }
  });

  it("does not leak rows from other profiles", async () => {
    const result = await repo.listByProfileId("p-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.find((o) => o.id === "o-other")).toBeUndefined();
    }
  });
});

describe("OrdersRepository.countByProfileId", () => {
  beforeEach(() => {
    store.seedOrder(
      buildOrderRow({ id: "a", sender_profile_id: "p-1", status: "pending" }),
    );
    store.seedOrder(
      buildOrderRow({
        id: "b",
        sender_profile_id: "p-1",
        status: "completed",
      }),
    );
    store.seedOrder(
      buildOrderRow({
        id: "c",
        sender_profile_id: "p-1",
        status: "completed",
      }),
    );
    store.seedOrder(
      buildOrderRow({ id: "d", sender_profile_id: "p-2" }),
    );
  });

  it("counts all orders for the profile without a status filter", async () => {
    const result = await repo.countByProfileId("p-1");
    expect(result).toEqual({ ok: true, data: 3 });
  });

  it("counts orders narrowed by status", async () => {
    const result = await repo.countByProfileId("p-1", "completed");
    expect(result).toEqual({ ok: true, data: 2 });
  });

  it("returns 0 for a profile with no orders", async () => {
    const result = await repo.countByProfileId("p-unknown");
    expect(result).toEqual({ ok: true, data: 0 });
  });
});

describe("OrdersRepository.listActive", () => {
  beforeEach(() => {
    store.seedOrder(
      buildOrderRow({ id: "active-pending", status: "pending" }),
    );
    store.seedOrder(
      buildOrderRow({ id: "active-in-progress", status: "in_progress" }),
    );
    store.seedOrder(
      buildOrderRow({ id: "done", status: "completed" }),
    );
    store.seedOrder(
      buildOrderRow({ id: "dead", status: "failed" }),
    );
  });

  it("returns only pending and in_progress orders", async () => {
    const result = await repo.listActive();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      const ids = result.data.map((o) => o.id).sort();
      expect(ids).toEqual(["active-in-progress", "active-pending"]);
    }
  });

  it("respects an explicit limit", async () => {
    const result = await repo.listActive({ limit: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(1);
  });

  it("returns [] when nothing is active", async () => {
    store.orderRows.clear();
    store.seedOrder(buildOrderRow({ id: "done", status: "completed" }));
    const result = await repo.listActive();
    expect(result).toEqual({ ok: true, data: [] });
  });
});
