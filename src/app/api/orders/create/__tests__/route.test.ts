import { afterEach, describe, expect, it, vi } from "vitest";

const clerkMock = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => ({ auth: clerkMock.auth }));

const { POST } = await import("@/app/api/orders/create/route");

afterEach(() => vi.clearAllMocks());

describe("POST /api/orders/create — legacy checkout tombstone", () => {
  it("returns 401 when unauthenticated", async () => {
    clerkMock.auth.mockResolvedValue({ userId: null });
    const response = await POST(new Request("https://test.local/api/orders/create", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("never creates an unpaid order and redirects authenticated clients to integrated checkout", async () => {
    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    const response = await POST(new Request("https://test.local/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localOrderId: "SKY-PT-LEGACY" }),
    }));
    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      error: "integrated_checkout_required",
      redirectTo: "/client/create-delivery?checkout=moved",
    });
  });

  it.each([
    ["an empty body", undefined],
    ["a pending-payment payload", { localOrderId: "SKY-PENDING", paymentStatus: "pending" }],
    ["a client-asserted paid payload", { localOrderId: "SKY-PAID", paymentStatus: "paid", stripePaymentIntentId: "pi_client" }],
    ["a duplicate legacy identifier", { localOrderId: "SKY-DUPLICATE" }],
    ["arbitrary legacy fields", { localOrderId: "SKY-ARBITRARY", amount: 1, status: "completed" }],
  ])("rejects %s without parsing it into an order", async (_label, body) => {
    clerkMock.auth.mockResolvedValue({ userId: "user_client" });
    const response = await POST(new Request("https://test.local/api/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
    expect(response.status).toBe(410);
  });
});
