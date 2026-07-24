import { beforeEach, describe, expect, it, vi } from "vitest";

const stripeMock = vi.hoisted(() => ({
  createSetupIntent: vi.fn(),
  getAuthenticatedCustomer: vi.fn(),
}));

vi.mock("@/lib/stripe/server", () => ({
  getAuthenticatedStripeCustomer: stripeMock.getAuthenticatedCustomer,
  listStripeCustomerPaymentMethods: vi.fn(),
  StripeAuthenticationError: class StripeAuthenticationError extends Error {},
}));

const { POST } = await import("@/app/api/stripe/setup-intent/route");

beforeEach(() => {
  vi.clearAllMocks();
  stripeMock.createSetupIntent.mockResolvedValue({
    id: "seti_test",
    client_secret: "seti_test_secret",
  });
  stripeMock.getAuthenticatedCustomer.mockResolvedValue({
    stripe: {
      setupIntents: {
        create: stripeMock.createSetupIntent,
      },
    },
    customer: { id: "cus_test" },
    clerkUserId: "user_test",
  });
});

describe("POST /api/stripe/setup-intent", () => {
  it("creates a card-only SetupIntent so the saved method remains listable as a card", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/stripe/setup-intent", {
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(stripeMock.createSetupIntent).toHaveBeenCalledWith({
      customer: "cus_test",
      usage: "off_session",
      metadata: {
        clerkUserId: "user_test",
        product: "skysend",
      },
      payment_method_types: ["card"],
    });
  });
});
