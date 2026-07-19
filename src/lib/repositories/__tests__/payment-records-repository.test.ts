import { beforeEach, describe, expect, it } from "vitest";

import { PaymentRecordsRepository } from "@/lib/repositories/payment-records-repository";
import {
  buildPaymentRecordRow,
  createFakeSupabase,
  type FakeStore,
} from "@/lib/repositories/__tests__/fake-supabase-client";

let store: FakeStore;
let repo: PaymentRecordsRepository;

beforeEach(() => {
  const fake = createFakeSupabase();
  store = fake.store;
  repo = new PaymentRecordsRepository(fake.client);
});

describe("PaymentRecordsRepository.getById", () => {
  it("returns the mapped record when the row exists", async () => {
    store.seedPaymentRecord(
      buildPaymentRecordRow({ id: "pr-1", amount_minor: 4500 }),
    );
    const result = await repo.getById("pr-1");
    expect(result.ok).toBe(true);
    if (result.ok && result.data) {
      expect(result.data.id).toBe("pr-1");
      expect(result.data.amountMinor).toBe(4500);
      expect(result.data.type).toBe("payment");
    }
  });

  it("returns data: null when no row matches", async () => {
    const result = await repo.getById("nope");
    expect(result).toEqual({ ok: true, data: null });
  });
});

describe("PaymentRecordsRepository.create", () => {
  it("creates a payment record with defaults applied", async () => {
    const result = await repo.create({
      orderId: "o-1",
      profileId: "p-1",
      amountMinor: 3100,
      type: "payment",
      status: "succeeded",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.orderId).toBe("o-1");
      expect(result.data.profileId).toBe("p-1");
      expect(result.data.amountMinor).toBe(3100);
      expect(result.data.currency).toBe("RON");
      expect(result.data.type).toBe("payment");
      expect(result.data.status).toBe("succeeded");
    }
  });

  it("creates a refund row with a non-negative amount", async () => {
    const result = await repo.create({
      orderId: "o-1",
      profileId: "p-1",
      amountMinor: 1000,
      type: "partial_refund",
      status: "succeeded",
      stripeRefundId: "re_abc",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.type).toBe("partial_refund");
      expect(result.data.amountMinor).toBe(1000);
      expect(result.data.stripeRefundId).toBe("re_abc");
    }
  });

  it("rejects a negative amountMinor", async () => {
    const result = await repo.create({
      orderId: "o-1",
      profileId: "p-1",
      amountMinor: -100,
      type: "refund",
      status: "succeeded",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("rejects a missing orderId", async () => {
    const result = await repo.create({
      orderId: "",
      profileId: "p-1",
      amountMinor: 100,
      type: "payment",
      status: "succeeded",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("rejects an unknown type", async () => {
    const result = await repo.create({
      orderId: "o-1",
      profileId: "p-1",
      amountMinor: 100,
      type: "chargeback" as never,
      status: "succeeded",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});

describe("PaymentRecordsRepository immutability", () => {
  it("does not expose updateById on the public surface", () => {
    expect(
      (repo as unknown as { updateById?: unknown }).updateById,
    ).toBeUndefined();
  });

  it("does not expose deleteById on the public surface", () => {
    expect(
      (repo as unknown as { deleteById?: unknown }).deleteById,
    ).toBeUndefined();
  });
});

describe("PaymentRecordsRepository.listByOrderId", () => {
  beforeEach(() => {
    const isoFor = (day: number) =>
      `2026-05-${String(day).padStart(2, "0")}T10:00:00Z`;

    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "pr-pay",
        order_id: "o-1",
        type: "payment",
        amount_minor: 3100,
        created_at: isoFor(1),
      }),
    );
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "pr-refund",
        order_id: "o-1",
        type: "partial_refund",
        amount_minor: 500,
        created_at: isoFor(5),
      }),
    );
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "pr-other",
        order_id: "o-2",
        type: "payment",
        amount_minor: 999,
      }),
    );
  });

  it("returns payments for the order in chronological order", async () => {
    const result = await repo.listByOrderId("o-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe("pr-pay");
      expect(result.data[1].id).toBe("pr-refund");
    }
  });

  it("does not leak rows from other orders", async () => {
    const result = await repo.listByOrderId("o-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.find((r) => r.id === "pr-other")).toBeUndefined();
    }
  });

  it("returns an empty array when the order has no payments", async () => {
    const result = await repo.listByOrderId("o-unknown");
    expect(result).toEqual({ ok: true, data: [] });
  });
});

describe("PaymentRecordsRepository.listByProfileId", () => {
  beforeEach(() => {
    const isoFor = (day: number) =>
      `2026-05-${String(day).padStart(2, "0")}T10:00:00Z`;

    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "p1-a",
        profile_id: "p-1",
        amount_minor: 1000,
        created_at: isoFor(1),
      }),
    );
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "p1-b",
        profile_id: "p-1",
        amount_minor: 5000,
        created_at: isoFor(5),
      }),
    );
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "p1-c",
        profile_id: "p-1",
        amount_minor: 3000,
        created_at: isoFor(3),
      }),
    );
    store.seedPaymentRecord(
      buildPaymentRecordRow({ id: "p2", profile_id: "p-2" }),
    );
  });

  it("returns the profile's records newest-first by default", async () => {
    const result = await repo.listByProfileId("p-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(3);
      expect(result.data.map((r) => r.id)).toEqual(["p1-b", "p1-c", "p1-a"]);
    }
  });

  it("orders by amount_minor DESC when requested", async () => {
    const result = await repo.listByProfileId("p-1", {
      orderBy: "amount_minor",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.map((r) => r.amountMinor)).toEqual([
        5000, 3000, 1000,
      ]);
    }
  });

  it("respects a limit", async () => {
    const result = await repo.listByProfileId("p-1", { limit: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toHaveLength(2);
  });
});

describe("PaymentRecordsRepository.sumAmountForOrder", () => {
  it("returns 0 for an order with no records", async () => {
    const result = await repo.sumAmountForOrder("o-empty");
    expect(result).toEqual({ ok: true, data: 0 });
  });

  it("sums a single succeeded payment", async () => {
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        order_id: "o-1",
        type: "payment",
        status: "succeeded",
        amount_minor: 3100,
      }),
    );
    const result = await repo.sumAmountForOrder("o-1");
    expect(result).toEqual({ ok: true, data: 3100 });
  });

  it("subtracts refunds from payments (net balance)", async () => {
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "r1",
        order_id: "o-1",
        type: "payment",
        status: "succeeded",
        amount_minor: 3100,
      }),
    );
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "r2",
        order_id: "o-1",
        type: "partial_refund",
        status: "succeeded",
        amount_minor: 500,
      }),
    );
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "r3",
        order_id: "o-1",
        type: "refund",
        status: "succeeded",
        amount_minor: 1000,
      }),
    );
    const result = await repo.sumAmountForOrder("o-1");
    expect(result).toEqual({ ok: true, data: 1600 });
  });

  it("excludes non-succeeded rows from the sum", async () => {
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "ok",
        order_id: "o-1",
        type: "payment",
        status: "succeeded",
        amount_minor: 3100,
      }),
    );
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "pending",
        order_id: "o-1",
        type: "payment",
        status: "pending",
        amount_minor: 9999,
      }),
    );
    store.seedPaymentRecord(
      buildPaymentRecordRow({
        id: "failed",
        order_id: "o-1",
        type: "refund",
        status: "failed",
        amount_minor: 500,
      }),
    );
    const result = await repo.sumAmountForOrder("o-1");
    expect(result).toEqual({ ok: true, data: 3100 });
  });
});
