import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stripeMock = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  processStripeEvent: vi.fn(),
}));

vi.mock("@/lib/stripe/server", () => ({
  getStripeServer: () => ({
    webhooks: { constructEvent: stripeMock.constructEvent },
  }),
}));

vi.mock("@/lib/stripe/webhook-server", () => ({
  processStripeEvent: stripeMock.processStripeEvent,
}));

const { POST } = await import("@/app/api/webhooks/stripe/route");

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  stripeMock.constructEvent.mockReset();
  stripeMock.processStripeEvent.mockReset();
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe("POST /api/webhooks/stripe", () => {
  it("rejects an invalid signature before processing an event", async () => {
    stripeMock.constructEvent.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(
      new Request("https://app.skysend.test/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Stripe-Signature": "invalid",
        },
        body: JSON.stringify({ id: "evt_invalid" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_signature" });
    expect(stripeMock.processStripeEvent).not.toHaveBeenCalled();
  });
});
