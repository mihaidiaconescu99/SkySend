import { describe, expect, it } from "vitest";

import {
  createInputToRow,
  parseDispatchTiming,
  parseHandoffPointsSnapshot,
  parseOrderStatus,
  parsePaymentStatus,
  parsePricingSnapshot,
  parseStoredHandoffPoint,
  rowToOrder,
  updateInputToRow,
} from "@/lib/repositories/mappers/order-mapper";
import { RepositoryError, type DBRow } from "@/lib/repositories/types";
import type { PricingSnapshot, StoredHandoffPoint } from "@/types/order";

const VALID_PRICING_SNAPSHOT: PricingSnapshot = {
  version: "skysend-pricing-v1",
  baseFee: 990,
  distanceFee: 1320,
  configMultiplier: 1,
  dispatchAdjustment: 0,
  surcharges: [],
  subtotal: 2310,
  total: 2310,
};

const VALID_HANDOFF_POINT: StoredHandoffPoint = {
  id: "hp-1",
  label: "Locker A",
  location: { latitude: 44.85, longitude: 24.87 },
  source: "geoapify_places",
  confidence: "high",
};

function buildOrderRow(
  overrides: Partial<DBRow<"orders">> = {},
): DBRow<"orders"> {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    local_order_id: "SKY-PT-12345",
    public_tracking_code: "TRK-ABCDEF",
    public_code_access_mode: "view",
    recipient_tracking_token: "TKN-XYZ",
    sender_profile_id: "00000000-0000-0000-0000-000000000111",
    recipient_email: "recipient@example.com",
    recipient_name: "Maria Ionescu",
    recipient_phone: "+40712345678",
    pickup_address_id: "00000000-0000-0000-0000-000000000222",
    dropoff_address_id: "00000000-0000-0000-0000-000000000333",
    parcel_id: "00000000-0000-0000-0000-000000000444",
    status: "pending",
    fulfillment_status: null,
    dispatch_timing: "standard",
    scheduled_at: null,
    drone_class: "medium_standard",
    delivery_configuration_id: "aer_express",
    eta_min_minutes: 15,
    eta_max_minutes: 25,
    total_amount_minor: 2310,
    currency: "RON",
    pricing_snapshot: VALID_PRICING_SNAPSHOT as never,
    handoff_points_snapshot: null,
    selected_pickup_handoff_point: null,
    selected_dropoff_handoff_point: null,
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    payment_status: "pending",
    refund_status: null,
    notes: null,
    created_at: "2026-05-23T10:00:00Z",
    updated_at: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("rowToOrder", () => {
  it("maps every column for a healthy row", () => {
    const row = buildOrderRow();
    const order = rowToOrder(row);
    expect(order.id).toBe(row.id);
    expect(order.localOrderId).toBe("SKY-PT-12345");
    expect(order.publicTrackingCode).toBe("TRK-ABCDEF");
    expect(order.recipientTrackingToken).toBe("TKN-XYZ");
    expect(order.status).toBe("pending");
    expect(order.dispatchTiming).toBe("standard");
    expect(order.paymentStatus).toBe("pending");
    expect(order.etaMinMinutes).toBe(15);
    expect(order.etaMaxMinutes).toBe(25);
    expect(order.pricingSnapshot).toEqual(VALID_PRICING_SNAPSHOT);
  });

  it("preserves all nullable string fields when null", () => {
    const order = rowToOrder(
      buildOrderRow({
        recipient_email: null,
        recipient_name: null,
        recipient_phone: null,
        fulfillment_status: null,
        scheduled_at: null,
        stripe_payment_intent_id: null,
        stripe_charge_id: null,
        refund_status: null,
        notes: null,
      }),
    );
    expect(order.recipientEmail).toBeNull();
    expect(order.recipientName).toBeNull();
    expect(order.recipientPhone).toBeNull();
    expect(order.fulfillmentStatus).toBeNull();
    expect(order.scheduledAt).toBeNull();
    expect(order.stripePaymentIntentId).toBeNull();
    expect(order.stripeChargeId).toBeNull();
    expect(order.refundStatus).toBeNull();
    expect(order.notes).toBeNull();
  });

  it("preserves null ETA bounds", () => {
    const order = rowToOrder(
      buildOrderRow({ eta_min_minutes: null, eta_max_minutes: null }),
    );
    expect(order.etaMinMinutes).toBeNull();
    expect(order.etaMaxMinutes).toBeNull();
  });

  it("throws on an unknown status", () => {
    expect(() =>
      rowToOrder(buildOrderRow({ status: "weird" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on an unknown dispatch_timing", () => {
    expect(() =>
      rowToOrder(buildOrderRow({ dispatch_timing: "moonwalk" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on an unknown payment_status", () => {
    expect(() =>
      rowToOrder(buildOrderRow({ payment_status: "void" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on missing local_order_id", () => {
    expect(() =>
      rowToOrder(buildOrderRow({ local_order_id: "" })),
    ).toThrowError(RepositoryError);
  });

  it("throws on a malformed pricing_snapshot (non-object)", () => {
    expect(() =>
      rowToOrder(buildOrderRow({ pricing_snapshot: "oops" as never })),
    ).toThrowError(RepositoryError);
  });

  it("throws on a malformed handoff_points_snapshot (missing pickup array)", () => {
    expect(() =>
      rowToOrder(
        buildOrderRow({
          handoff_points_snapshot: { dropoff: [] } as never,
        }),
      ),
    ).toThrowError(RepositoryError);
  });

  it("parses a populated handoff_points_snapshot", () => {
    const order = rowToOrder(
      buildOrderRow({
        handoff_points_snapshot: {
          pickup: [VALID_HANDOFF_POINT],
          dropoff: [VALID_HANDOFF_POINT],
        } as never,
      }),
    );
    expect(order.handoffPointsSnapshot).not.toBeNull();
    expect(order.handoffPointsSnapshot?.pickup).toHaveLength(1);
    expect(order.handoffPointsSnapshot?.dropoff[0].id).toBe("hp-1");
  });

  it("parses selected pickup and dropoff handoff points individually", () => {
    const order = rowToOrder(
      buildOrderRow({
        selected_pickup_handoff_point: VALID_HANDOFF_POINT as never,
        selected_dropoff_handoff_point: VALID_HANDOFF_POINT as never,
      }),
    );
    expect(order.selectedPickupHandoffPoint?.id).toBe("hp-1");
    expect(order.selectedDropoffHandoffPoint?.label).toBe("Locker A");
  });
});

describe("parsePricingSnapshot", () => {
  it("accepts a complete valid snapshot", () => {
    expect(parsePricingSnapshot(VALID_PRICING_SNAPSHOT)).toEqual(
      VALID_PRICING_SNAPSHOT,
    );
  });

  it("preserves optional scheduledAdjustment when provided", () => {
    const snapshot: PricingSnapshot = {
      ...VALID_PRICING_SNAPSHOT,
      scheduledAdjustment: -50,
    };
    expect(parsePricingSnapshot(snapshot).scheduledAdjustment).toBe(-50);
  });

  it("parses populated surcharges", () => {
    const snapshot: PricingSnapshot = {
      ...VALID_PRICING_SNAPSHOT,
      surcharges: [
        { type: "weight", amount: 700, label: "Greutate" },
        { type: "fragile", amount: 300, label: "Fragil" },
      ],
    };
    const result = parsePricingSnapshot(snapshot);
    expect(result.surcharges).toHaveLength(2);
    expect(result.surcharges[0].type).toBe("weight");
  });

  it("throws when surcharges is missing", () => {
    expect(() =>
      parsePricingSnapshot({ ...VALID_PRICING_SNAPSHOT, surcharges: undefined }),
    ).toThrowError(RepositoryError);
  });

  it("throws when surcharge entry is malformed", () => {
    expect(() =>
      parsePricingSnapshot({
        ...VALID_PRICING_SNAPSHOT,
        surcharges: [{ type: "x", amount: "five", label: "X" }],
      }),
    ).toThrowError(RepositoryError);
  });

  it("throws when total is missing", () => {
    const broken = { ...VALID_PRICING_SNAPSHOT } as Partial<PricingSnapshot>;
    delete broken.total;
    expect(() => parsePricingSnapshot(broken)).toThrowError(RepositoryError);
  });

  it("throws when version is missing", () => {
    const broken = { ...VALID_PRICING_SNAPSHOT } as Partial<PricingSnapshot>;
    delete broken.version;
    expect(() => parsePricingSnapshot(broken)).toThrowError(RepositoryError);
  });
});

describe("parseHandoffPointsSnapshot / parseStoredHandoffPoint", () => {
  it("returns null for a null snapshot", () => {
    expect(parseHandoffPointsSnapshot(null)).toBeNull();
  });

  it("throws when snapshot is missing arrays", () => {
    expect(() =>
      parseHandoffPointsSnapshot({ pickup: [], dropoff: "not-array" }),
    ).toThrowError(RepositoryError);
  });

  it("requires a location object on a stored handoff point", () => {
    expect(() =>
      parseStoredHandoffPoint({ id: "x", label: "Test" }),
    ).toThrowError(RepositoryError);
  });

  it("preserves extra fields on a stored handoff point", () => {
    const point = parseStoredHandoffPoint({
      ...VALID_HANDOFF_POINT,
      smartScore: 0.92,
      extraField: { custom: "data" },
    });
    expect(point.smartScore).toBe(0.92);
    expect(point.extraField).toEqual({ custom: "data" });
  });
});

describe("createInputToRow", () => {
  const baseInput = {
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
    pricingSnapshot: VALID_PRICING_SNAPSHOT,
  };

  it("emits a complete row from minimal required input", () => {
    const row = createInputToRow(baseInput);
    expect(row.local_order_id).toBe("SKY-PT-99999");
    expect(row.pricing_snapshot).toEqual(VALID_PRICING_SNAPSHOT);
    expect(row.total_amount_minor).toBe(2310);
    expect(row.dispatch_timing).toBe("standard");
  });

  it("throws on missing publicTrackingCode", () => {
    expect(() =>
      createInputToRow({ ...baseInput, publicTrackingCode: "" }),
    ).toThrowError(RepositoryError);
  });

  it("throws on missing recipientTrackingToken", () => {
    expect(() =>
      createInputToRow({ ...baseInput, recipientTrackingToken: "" }),
    ).toThrowError(RepositoryError);
  });

  it("rejects totalAmountMinor below 100", () => {
    expect(() =>
      createInputToRow({ ...baseInput, totalAmountMinor: 50 }),
    ).toThrowError(RepositoryError);
  });

  it("rejects a pricing snapshot with total below 100", () => {
    expect(() =>
      createInputToRow({
        ...baseInput,
        pricingSnapshot: { ...VALID_PRICING_SNAPSHOT, total: 50 },
      }),
    ).toThrowError(RepositoryError);
  });

  it("preserves optional handoff snapshot fields when provided", () => {
    const row = createInputToRow({
      ...baseInput,
      handoffPointsSnapshot: {
        pickup: [VALID_HANDOFF_POINT],
        dropoff: [VALID_HANDOFF_POINT],
      },
      selectedPickupHandoffPoint: VALID_HANDOFF_POINT,
    });
    expect(row.handoff_points_snapshot).toBeDefined();
    expect(row.selected_pickup_handoff_point).toBeDefined();
  });
});

describe("updateInputToRow", () => {
  it("emits a sparse payload toggling status", () => {
    expect(updateInputToRow({ status: "in_progress" })).toEqual({
      status: "in_progress",
    });
  });

  it("emits a paired payment update", () => {
    expect(
      updateInputToRow({
        paymentStatus: "refunded",
        refundStatus: "stripe_processed",
      }),
    ).toEqual({
      payment_status: "refunded",
      refund_status: "stripe_processed",
    });
  });

  it("throws validation_error on empty input", () => {
    expect(() => updateInputToRow({})).toThrowError(RepositoryError);
  });

  it("rejects an invalid status", () => {
    expect(() =>
      updateInputToRow({ status: "weird" as never }),
    ).toThrowError(RepositoryError);
  });

  it("preserves explicit null for nullable fields (clears)", () => {
    const payload = updateInputToRow({
      recipientEmail: null,
      fulfillmentStatus: null,
    });
    expect(payload.recipient_email).toBeNull();
    expect(payload.fulfillment_status).toBeNull();
  });
});

describe("Enum parsers", () => {
  it("accepts canonical OrderStatus / DispatchTiming / PaymentStatus values", () => {
    expect(parseOrderStatus("pending")).toBe("pending");
    expect(parseDispatchTiming("scheduled")).toBe("scheduled");
    expect(parsePaymentStatus("refund_pending")).toBe("refund_pending");
  });

  it("rejects unknown enum values", () => {
    expect(() => parseOrderStatus("zombie")).toThrowError(RepositoryError);
    expect(() => parseDispatchTiming("yesterday")).toThrowError(
      RepositoryError,
    );
    expect(() => parsePaymentStatus("free")).toThrowError(RepositoryError);
  });
});
