import { describe, expect, it } from "vitest";

import {
  getClientOrderStatusFilter,
  mapDbPaymentStatusToCreated,
  mapDbStatusToClientStatus,
  mapOrderSummary,
  mapOrderToCreatedDelivery,
} from "@/lib/client-orders-mappers";
import type { Order } from "@/types/order";

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    localOrderId: "SKY-PT-1",
    publicTrackingCode: "TRK-PUB",
    recipientTrackingToken: "TKN-REC",
    senderProfileId: "p-1",
    recipientEmail: null,
    recipientName: null,
    recipientPhone: null,
    pickupAddressId: "addr-pickup",
    dropoffAddressId: "addr-dropoff",
    parcelId: "parcel-1",
    status: "pending",
    fulfillmentStatus: "order_created",
    dispatchTiming: "standard",
    scheduledAt: null,
    droneClass: "medium_standard",
    deliveryConfigurationId: "default",
    etaMinMinutes: 10,
    etaMaxMinutes: 20,
    totalAmountMinor: 2310,
    currency: "RON",
    pricingSnapshot: {
      version: "skysend-pricing-v1",
      baseFee: 990,
      distanceFee: 1320,
      configMultiplier: 1,
      dispatchAdjustment: 0,
      surcharges: [],
      subtotal: 2310,
      total: 2310,
    },
    handoffPointsSnapshot: null,
    selectedPickupHandoffPoint: {
      id: "hp-1",
      label: "Piața Primăriei",
      location: { latitude: 44.8565, longitude: 24.8692 },
    },
    selectedDropoffHandoffPoint: {
      id: "hp-2",
      label: "Bulevardul Republicii 12",
      location: { latitude: 44.87, longitude: 24.88 },
    },
    stripePaymentIntentId: "pi_test",
    stripeChargeId: null,
    paymentStatus: "paid",
    refundStatus: null,
    notes: null,
    createdAt: "2026-05-23T10:00:00Z",
    updatedAt: "2026-05-23T10:00:00Z",
    ...overrides,
  };
}

describe("mapDbStatusToClientStatus", () => {
  it("maps repo statuses to client domain statuses", () => {
    expect(mapDbStatusToClientStatus("pending")).toBe("scheduled");
    expect(mapDbStatusToClientStatus("in_progress")).toBe("in_flight");
    expect(mapDbStatusToClientStatus("completed")).toBe("delivered");
    expect(mapDbStatusToClientStatus("failed")).toBe("failed");
    expect(mapDbStatusToClientStatus("cancelled")).toBe("cancelled");
  });
});

describe("getClientOrderStatusFilter", () => {
  it("returns 'scheduled' for pending orders", () => {
    expect(getClientOrderStatusFilter(buildOrder())).toBe("scheduled");
  });

  it("returns 'active' for in_progress orders", () => {
    expect(
      getClientOrderStatusFilter(buildOrder({ status: "in_progress" })),
    ).toBe("active");
  });

  it("returns 'completed' for completed orders", () => {
    expect(
      getClientOrderStatusFilter(buildOrder({ status: "completed" })),
    ).toBe("completed");
  });

  it("returns 'scheduled' for a scheduled order whose scheduledAt is in the future", () => {
    const future = new Date(Date.now() + 60_000 * 60 * 24).toISOString();
    expect(
      getClientOrderStatusFilter(
        buildOrder({ dispatchTiming: "scheduled", scheduledAt: future }),
      ),
    ).toBe("scheduled");
  });
});

describe("mapDbPaymentStatusToCreated", () => {
  it("maps paid → paid", () => {
    expect(mapDbPaymentStatusToCreated("paid")).toBe("paid");
  });
  it("maps failed → failed", () => {
    expect(mapDbPaymentStatusToCreated("failed")).toBe("failed");
  });
  it("maps refund_pending → refund_pending", () => {
    expect(mapDbPaymentStatusToCreated("refund_pending")).toBe("refund_pending");
  });
  it("falls back to 'unpaid' for unknown values", () => {
    expect(mapDbPaymentStatusToCreated("nope" as never)).toBe("unpaid");
  });
});

describe("mapOrderSummary", () => {
  it("produces a summary for a paid standard order", () => {
    const summary = mapOrderSummary(buildOrder());

    expect(summary.id).toBe("SKY-PT-1");
    expect(summary.href).toBe("/client/orders/SKY-PT-1");
    expect(summary.statusFilter).toBe("scheduled");
    expect(summary.payment.status).toBe("paid");
    expect(summary.payment.statusLabel).toBe("PlatÄƒ confirmatÄƒ");
    expect(summary.payment.amountLabel).toMatch(/23[.,]10/);
  });

  it("uses the handoff labels for area text", () => {
    const summary = mapOrderSummary(buildOrder());

    expect(summary.pickupArea).toBe("Piața Primăriei");

    expect(summary.dropoffArea).toBe("Republicii");
  });
});

describe("mapOrderToCreatedDelivery", () => {
  it("returns a CreatedDeliveryOrder with paid payment status", () => {
    const created = mapOrderToCreatedDelivery(buildOrder());

    expect(created.id).toBe("SKY-PT-1");
    expect(created.paymentStatus).toBe("paid");
    expect(created.fulfillmentStatus).toBe("order_created");
    expect(created.publicTrackingCode).toBe("TRK-PUB");
    expect(created.stripePaymentIntentId).toBe("pi_test");
    expect(created.href).toBe("/client/orders/SKY-PT-1");
  });

  it("fills paymentStatus='unpaid' when the DB row is unpaid", () => {
    const created = mapOrderToCreatedDelivery(
      buildOrder({ paymentStatus: "pending", stripePaymentIntentId: null }),
    );

    expect(created.paymentStatus).toBe("unpaid");
  });
});
