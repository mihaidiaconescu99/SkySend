import { describe, expect, it } from "vitest";

import {
  createInputToRow,
  parsePaymentRecordStatus,
  parsePaymentRecordType,
  rowToPaymentRecord,
  validateCurrency,
} from "@/lib/repositories/mappers/payment-record-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";

function buildRow(
  overrides: Partial<DBRow<"payment_records">> = {},
): DBRow<"payment_records"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    order_id: "00000000-0000-0000-0000-000000000111",
    profile_id: "00000000-0000-0000-0000-000000000222",
    stripe_payment_intent_id: "pi_test_123",
    stripe_charge_id: "ch_test_123",
    stripe_refund_id: null,
    amount_minor: 3100,
    currency: "RON",
    type: "payment",
    status: "succeeded",
    failure_reason: null,
    created_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("rowToPaymentRecord", () => {
  it("maps every column for a healthy payment row", () => {
    const row = buildRow();
    expect(rowToPaymentRecord(row)).toEqual({
      id: row.id,
      orderId: row.order_id,
      profileId: row.profile_id,
      stripePaymentIntentId: "pi_test_123",
      stripeChargeId: "ch_test_123",
      stripeRefundId: null,
      amountMinor: 3100,
      currency: "RON",
      type: "payment",
      status: "succeeded",
      failureReason: null,
      createdAt: row.created_at,
    });
  });

  it("preserves a refund row with stripe_refund_id set", () => {
    const result = rowToPaymentRecord(
      buildRow({
        type: "refund",
        stripe_refund_id: "re_test_456",
        amount_minor: 3100,
      }),
    );
    expect(result.type).toBe("refund");
    expect(result.stripeRefundId).toBe("re_test_456");
  });

  it("throws on an unknown type", () => {
    expect(() =>
      rowToPaymentRecord(buildRow({ type: "chargeback" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on an unknown status", () => {
    expect(() =>
      rowToPaymentRecord(buildRow({ status: "weird" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on a negative amount_minor", () => {
    expect(() =>
      rowToPaymentRecord(buildRow({ amount_minor: -100 })),
    ).toThrowError(RepositoryError);
  });

  it("throws on a non-integer amount_minor", () => {
    expect(() =>
      rowToPaymentRecord(buildRow({ amount_minor: 12.5 })),
    ).toThrowError(RepositoryError);
  });

  it("throws on an invalid currency", () => {
    expect(() =>
      rowToPaymentRecord(buildRow({ currency: "ron" })),
    ).toThrowError(RepositoryError);
  });
});

describe("createInputToRow", () => {
  it("returns a complete row from a minimal valid input", () => {
    const row = createInputToRow({
      orderId: "o-1",
      profileId: "p-1",
      amountMinor: 3100,
      type: "payment",
      status: "succeeded",
    });
    expect(row).toEqual({
      order_id: "o-1",
      profile_id: "p-1",
      amount_minor: 3100,
      currency: "RON",
      type: "payment",
      status: "succeeded",
    });
  });

  it("accepts an explicit currency code", () => {
    const row = createInputToRow({
      orderId: "o-1",
      profileId: "p-1",
      amountMinor: 100,
      currency: "EUR",
      type: "payment",
      status: "succeeded",
    });
    expect(row.currency).toBe("EUR");
  });

  it("passes through Stripe IDs and failureReason when provided", () => {
    const row = createInputToRow({
      orderId: "o-1",
      profileId: "p-1",
      amountMinor: 100,
      type: "payment",
      status: "failed",
      stripePaymentIntentId: "pi_x",
      stripeChargeId: "ch_x",
      failureReason: "card_declined",
    });
    expect(row.stripe_payment_intent_id).toBe("pi_x");
    expect(row.stripe_charge_id).toBe("ch_x");
    expect(row.failure_reason).toBe("card_declined");
  });

  it("rejects a negative amountMinor", () => {
    expect(() =>
      createInputToRow({
        orderId: "o-1",
        profileId: "p-1",
        amountMinor: -1,
        type: "payment",
        status: "succeeded",
      }),
    ).toThrowError(RepositoryError);
  });

  it("rejects a non-integer amountMinor (refund of 12.5 bani)", () => {
    expect(() =>
      createInputToRow({
        orderId: "o-1",
        profileId: "p-1",
        amountMinor: 12.5,
        type: "refund",
        status: "succeeded",
      }),
    ).toThrowError(RepositoryError);
  });

  it("rejects an invalid currency length", () => {
    expect(() =>
      createInputToRow({
        orderId: "o-1",
        profileId: "p-1",
        amountMinor: 100,
        currency: "EURO",
        type: "payment",
        status: "succeeded",
      }),
    ).toThrowError(RepositoryError);
  });

  it("rejects an unknown type", () => {
    expect(() =>
      createInputToRow({
        orderId: "o-1",
        profileId: "p-1",
        amountMinor: 100,
        type: "chargeback" as never,
        status: "succeeded",
      }),
    ).toThrowError(RepositoryError);
  });

  it("rejects an unknown status", () => {
    expect(() =>
      createInputToRow({
        orderId: "o-1",
        profileId: "p-1",
        amountMinor: 100,
        type: "payment",
        status: "weird" as never,
      }),
    ).toThrowError(RepositoryError);
  });
});

describe("validateCurrency", () => {
  it("accepts RON, EUR, USD", () => {
    expect(validateCurrency("RON")).toBe("RON");
    expect(validateCurrency("EUR")).toBe("EUR");
    expect(validateCurrency("USD")).toBe("USD");
  });

  it("rejects lowercase", () => {
    expect(() => validateCurrency("ron")).toThrowError(RepositoryError);
  });

  it("rejects wrong length", () => {
    expect(() => validateCurrency("RO")).toThrowError(RepositoryError);
    expect(() => validateCurrency("EURO")).toThrowError(RepositoryError);
  });

  it("rejects non-strings", () => {
    expect(() => validateCurrency(null)).toThrowError(RepositoryError);
  });
});

describe("parsePaymentRecordType / parsePaymentRecordStatus", () => {
  it("accepts canonical types and statuses", () => {
    expect(parsePaymentRecordType("payment")).toBe("payment");
    expect(parsePaymentRecordType("refund")).toBe("refund");
    expect(parsePaymentRecordType("partial_refund")).toBe("partial_refund");
    expect(parsePaymentRecordStatus("pending")).toBe("pending");
    expect(parsePaymentRecordStatus("succeeded")).toBe("succeeded");
    expect(parsePaymentRecordStatus("failed")).toBe("failed");
  });

  it("rejects unknown values", () => {
    expect(() => parsePaymentRecordType("foo")).toThrowError(RepositoryError);
    expect(() => parsePaymentRecordStatus("foo")).toThrowError(RepositoryError);
  });
});
