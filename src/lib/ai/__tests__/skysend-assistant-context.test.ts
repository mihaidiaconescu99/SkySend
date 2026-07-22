import { describe, expect, it } from "vitest";
import {
  requestsPersonalOrderContext,
  toAssistantOrderContext,
} from "@/lib/ai/skysend-assistant-context";
import type { Order } from "@/types/order";

const order: Order = {
  id: "internal-order-id",
  localOrderId: "SKY-AG-12345-001",
  publicTrackingCode: "PUBLIC-SECRET",
  recipientTrackingToken: "RECIPIENT-SECRET",
  publicCodeAccessMode: "control",
  senderProfileId: "profile-1",
  recipientEmail: "recipient@example.com",
  recipientName: "Recipient",
  recipientPhone: "+40123456789",
  pickupAddressId: "address-1",
  dropoffAddressId: "address-2",
  parcelId: "parcel-1",
  status: "in_progress",
  fulfillmentStatus: "in_transit",
  dispatchTiming: "priority",
  scheduledAt: null,
  droneClass: "heavy",
  deliveryConfigurationId: "configuration-1",
  etaMinMinutes: 8,
  etaMaxMinutes: 12,
  totalAmountMinor: 4590,
  currency: "RON",
  pricingSnapshot: { version: "1", baseFee: 10, distanceFee: 20, configMultiplier: 1, dispatchAdjustment: 5, surcharges: [], subtotal: 35, total: 35 },
  handoffPointsSnapshot: null,
  selectedPickupHandoffPoint: null,
  selectedDropoffHandoffPoint: null,
  stripePaymentIntentId: "pi_secret",
  stripeChargeId: "ch_secret",
  paymentStatus: "paid",
  refundStatus: null,
  notes: "private note",
  createdAt: "2026-07-22T10:00:00.000Z",
  updatedAt: "2026-07-22T10:05:00.000Z",
};

describe("assistant account context", () => {
  it("contains only the allowlisted order fields", () => {
    const safe = toAssistantOrderContext(order);
    expect(safe).toMatchObject({ localOrderId: order.localOrderId, paymentStatus: "paid", amountMinor: 4590 });
    const serialized = JSON.stringify(safe);
    expect(serialized).not.toContain("recipient@example.com");
    expect(serialized).not.toContain("PUBLIC-SECRET");
    expect(serialized).not.toContain("RECIPIENT-SECRET");
    expect(serialized).not.toContain("pi_secret");
    expect(serialized).not.toContain("ch_secret");
    expect(serialized).not.toContain("private note");
  });

  it("only requests account lookup for personal questions", () => {
    expect(requestsPersonalOrderContext("Arată-mi ultimele mele comenzi")).toBe(true);
    expect(requestsPersonalOrderContext("Care sunt limitele unui colet?")).toBe(false);
  });
});

