import { describe, expect, it } from "vitest";

import { mapRepoOrderToAdminOrder } from "@/lib/admin-order-mapper";
import type { Order } from "@/types/order";

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    localOrderId: "SKY-PT-1",
    publicTrackingCode: "TRK-PUB",
    recipientTrackingToken: "TKN-REC",
    senderProfileId: "p-1",
    recipientEmail: "ana@example.com",
    recipientName: "Ana Pop",
    recipientPhone: null,
    pickupAddressId: "addr-pickup",
    dropoffAddressId: "addr-dropoff",
    parcelId: "parcel-1",
    status: "completed",
    fulfillmentStatus: "completed_mission",
    dispatchTiming: "standard",
    scheduledAt: null,
    droneClass: "medium_standard",
    deliveryConfigurationId: "aer_express",
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
    selectedDropoffHandoffPoint: null,
    stripePaymentIntentId: "pi_test",
    stripeChargeId: null,
    paymentStatus: "paid",
    refundStatus: null,
    notes: null,
    createdAt: "2026-05-23T10:00:00Z",
    updatedAt: "2026-05-23T10:05:00Z",
    ...overrides,
  };
}

describe("mapRepoOrderToAdminOrder", () => {
  it("maps a paid completed order to AdminOrder with persisted source", () => {
    const admin = mapRepoOrderToAdminOrder(buildOrder());

    expect(admin.id).toBe(buildOrder().id);
    expect(admin.source).toBe("supabase");
    expect(admin.persistence).toBe("persisted");
    expect(admin.status).toBe("delivered");
    expect(admin.statusLabel).toBe("Livrare finalizată");
    expect(admin.payment.status).toBe("paid");
    expect(admin.payment.amount?.amountMinor).toBe(2310);
    expect(admin.payment.provider).toBe("stripe");
    expect(admin.payment.providerReference).toBe("pi_test");
    expect(admin.metadata.publicTrackingCode).toBe("TRK-PUB");
  });

  it("marks a failed order as needs-review and reads notes for the failure reason", () => {
    const admin = mapRepoOrderToAdminOrder(
      buildOrder({ status: "failed", notes: "Drona a pierdut legătura GPS" }),
    );

    expect(admin.status).toBe("failed");
    expect(admin.failureReasonCode).not.toBeNull();
    expect(admin.failureReasonLabel).not.toBeNull();
    expect(admin.resolutionStatus).toBe("open");
    expect(admin.originalFailureReason).toBe("Drona a pierdut legătura GPS");
  });

  it("preserves the handoff point coordinates for the pickup marker", () => {
    const admin = mapRepoOrderToAdminOrder(buildOrder());

    expect(admin.pickup).not.toBeNull();
    expect(admin.pickup?.coordinates).toEqual({
      latitude: 44.8565,
      longitude: 24.8692,
    });
  });

  it("renders payment provider as null when no Stripe reference is present", () => {
    const admin = mapRepoOrderToAdminOrder(
      buildOrder({
        stripePaymentIntentId: null,
        stripeChargeId: null,
        paymentStatus: "pending",
      }),
    );

    expect(admin.payment.provider).toBeNull();
    expect(admin.payment.providerReference).toBeNull();
  });
});